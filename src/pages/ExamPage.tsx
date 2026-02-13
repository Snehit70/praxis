import { useParams } from 'react-router-dom';

export default function ExamPage() {
  const { examId } = useParams();
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Exam: {examId}</h2>
      <p className="text-muted-foreground">Select a course to continue.</p>
    </div>
  );
}
