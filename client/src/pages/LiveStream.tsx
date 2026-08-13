import DashboardLayout from "@/components/DashboardLayout";
import { ModernLiveStudio } from "@/components/ModernLiveStudio";

/**
 * Compatibility route for the original livestream URL.
 * The old page only toggled local prototype state and displayed fake platform
 * statuses. The real broadcast controls now live in ModernLiveStudio.
 */
export default function LiveStream() {
  return (
    <DashboardLayout>
      <ModernLiveStudio />
    </DashboardLayout>
  );
}
