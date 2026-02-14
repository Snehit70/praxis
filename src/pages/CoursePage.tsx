import { useParams } from 'react-router-dom';

export default function CoursePage() {
  const { courseId } = useParams();
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Course: {courseId}</h2>
      <p className="text-muted-foreground">Select a paper to practice.</p>
    </div>
  );
}
