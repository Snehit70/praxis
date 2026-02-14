import { useParams } from 'react-router-dom';

export default function PaperPage() {
  const { paperId } = useParams();
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Paper: {paperId}</h2>
      <div className="p-4 border rounded-lg bg-card">
        <p>Questions will appear here...</p>
      </div>
    </div>
  );
}
