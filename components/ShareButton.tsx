"use client";

import { Button } from "@heroui/button";
import { SlShare } from "react-icons/sl";
import { 
  shareOnWhatsApp, 
  formatTuitionShare, 
  formatJobShare, 
  type TuitionShareData, 
  type JobShareData 
} from "@/lib/utils/share";

type ShareButtonProps = 
  | { type: "tuition"; data: TuitionShareData; className?: string }
  | { type: "job"; data: JobShareData; className?: string };

export default function ShareButton({ type, data, className }: ShareButtonProps) {
  const handleShare = () => {
    if (type === "tuition") {
      shareOnWhatsApp(formatTuitionShare(data as TuitionShareData));
    } else {
      shareOnWhatsApp(formatJobShare(data as JobShareData));
    }
  };

  return (
    <Button className={className} size="lg" onPress={handleShare}>
      <SlShare size={18} className="inline-block mr-2" />
      Share
    </Button>
  );
}
