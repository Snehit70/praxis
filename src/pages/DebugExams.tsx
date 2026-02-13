import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function DebugExams() {
  const exams = useQuery(api.queries.listAllExams);

  useEffect(() => {
    if (exams) {
      logger.info('Available exams in database', { exams });
      console.log('=== AVAILABLE EXAMS ===');
      exams.forEach(exam => {
        console.log(`UUID: "${exam.uuid}" | Name: "${exam.examName}"`);
      });
    }
  }, [exams]);

  if (!exams) {
    return <div>Loading exams...</div>;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Debug: Available Exams</h1>
      <div className="space-y-2">
        {exams.map(exam => (
          <div key={exam._id} className="p-4 border rounded">
            <div><strong>UUID:</strong> {exam.uuid}</div>
            <div><strong>Name:</strong> {exam.examName}</div>
            <div><strong>ID:</strong> {exam._id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
