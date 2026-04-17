import { motion } from "framer-motion";
import { Clapperboard } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StoryEntryButtonProps {
  onClick: () => void;
}

const StoryEntryButton = ({ onClick }: StoryEntryButtonProps) => {
  const isMobile = useIsMobile();

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.5 }}
      onClick={onClick}
      className="fixed bottom-6 left-6 z-[9980] flex items-center gap-2 px-4 py-2.5 rounded-full
        bg-white/[0.06] backdrop-blur-xl border border-white/[0.08]
        text-white/70 hover:text-white hover:bg-white/[0.1] hover:border-white/[0.15]
        transition-all duration-300 group shadow-lg shadow-black/20"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Clapperboard className="h-[18px] w-[18px]" />
      </motion.div>
      {!isMobile && (
        <span className="text-sm font-medium tracking-wide">What's this?</span>
      )}
    </motion.button>
  );
};

export default StoryEntryButton;
