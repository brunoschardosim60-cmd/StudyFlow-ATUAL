import { Subject, SUBJECT_COLORS } from "@/lib/studyData";

export function SubjectBadge({ subject }: { subject: Subject }) {
  return (
    <span className={`subject-badge inline-flex max-w-[120px] sm:max-w-none truncate text-primary-foreground ${SUBJECT_COLORS[subject]}`}>
      {subject}
    </span>
  );
}
