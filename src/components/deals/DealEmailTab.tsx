import { Mail } from 'lucide-react';
import { EmailBodyFrame } from '@/components/inbox/EmailBodyFrame';

interface DealEmailTabProps {
  mailContent: string | null;
}

export function DealEmailTab({ mailContent }: DealEmailTabProps) {
  if (!mailContent || mailContent.trim() === '') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-background">
        <Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-foreground">Aucun email associé à ce deal</p>
        <p className="text-sm text-muted-foreground mt-2">
          Ce deal n'a pas été reçu par email.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Email original</h3>
      </div>

      {/* Email content */}
      <div className="p-4">
        <EmailBodyFrame html={mailContent} className="rounded-lg" />
      </div>
    </div>
  );
}
