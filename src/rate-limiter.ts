import fs from 'fs';
import path from 'path';

interface RateLimiterState {
    minDelay: number;
    maxDelay: number;
    consecutiveSuccesses: number;
    consecutiveErrors: number;
    lastUpdated: string;
}

const STATE_FILE = path.join(process.cwd(), 'scraper-state.json');
const INITIAL_MIN_DELAY = 300;
const INITIAL_MAX_DELAY = 1000;
const ABSOLUTE_MIN_DELAY = 300;
const ABSOLUTE_MAX_DELAY = 5000;
const SUCCESS_THRESHOLD = 50;
const SPEEDUP_FACTOR = 0.8;
const BACKOFF_MULTIPLIER = 2;

export class AdaptiveRateLimiter {
    private state: RateLimiterState;

    constructor() {
        this.state = this.loadState();
    }

    private loadState(): RateLimiterState {
        if (fs.existsSync(STATE_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                console.log(`📊 Loaded rate limiter state: ${data.minDelay}-${data.maxDelay}ms`);
                return data;
            } catch (e) {
                console.log('⚠️  Failed to load state, using defaults');
            }
        }
        return {
            minDelay: INITIAL_MIN_DELAY,
            maxDelay: INITIAL_MAX_DELAY,
            consecutiveSuccesses: 0,
            consecutiveErrors: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    private saveState() {
        this.state.lastUpdated = new Date().toISOString();
        fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
    }

    async sleep() {
        const delay = Math.floor(
            Math.random() * (this.state.maxDelay - this.state.minDelay + 1) + this.state.minDelay
        );
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    recordSuccess() {
        this.state.consecutiveSuccesses++;
        this.state.consecutiveErrors = 0;

        if (this.state.consecutiveSuccesses >= SUCCESS_THRESHOLD) {
            const oldMin = this.state.minDelay;
            const oldMax = this.state.maxDelay;

            this.state.minDelay = Math.max(
                ABSOLUTE_MIN_DELAY,
                Math.floor(this.state.minDelay * SPEEDUP_FACTOR)
            );
            this.state.maxDelay = Math.max(
                ABSOLUTE_MIN_DELAY,
                Math.floor(this.state.maxDelay * SPEEDUP_FACTOR)
            );

            if (oldMin !== this.state.minDelay || oldMax !== this.state.maxDelay) {
                console.log(`\n🚀 Speeding up: ${oldMin}-${oldMax}ms → ${this.state.minDelay}-${this.state.maxDelay}ms`);
                this.saveState();
            }

            this.state.consecutiveSuccesses = 0;
        }
    }

    recordError(error: any) {
        this.state.consecutiveErrors++;
        this.state.consecutiveSuccesses = 0;

        const oldMin = this.state.minDelay;
        const oldMax = this.state.maxDelay;

        this.state.minDelay = Math.min(
            ABSOLUTE_MAX_DELAY,
            this.state.minDelay * BACKOFF_MULTIPLIER
        );
        this.state.maxDelay = Math.min(
            ABSOLUTE_MAX_DELAY,
            this.state.maxDelay * BACKOFF_MULTIPLIER
        );

        const errorType = this.getErrorType(error);
        console.log(`\n⚠️  ${errorType} detected! Backing off: ${oldMin}-${oldMax}ms → ${this.state.minDelay}-${this.state.maxDelay}ms`);
        this.saveState();
    }

    private getErrorType(error: any): string {
        if (error.response) {
            const status = error.response.status;
            if (status === 429) return 'Rate limit (429)';
            if (status === 503) return 'Service unavailable (503)';
            if (status === 502) return 'Bad gateway (502)';
            return `HTTP ${status}`;
        }
        if (error.code === 'ECONNRESET') return 'Connection reset';
        if (error.code === 'ETIMEDOUT') return 'Timeout';
        if (error.code === 'ECONNREFUSED') return 'Connection refused';
        return 'Network error';
    }

    isRateLimitError(error: any): boolean {
        if (error.response) {
            const status = error.response.status;
            return status === 429 || status === 503 || status === 502;
        }
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
            return true;
        }
        return false;
    }

    getCurrentDelay(): string {
        return `${this.state.minDelay}-${this.state.maxDelay}ms`;
    }
}
