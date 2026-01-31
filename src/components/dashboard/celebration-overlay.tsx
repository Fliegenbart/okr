"use client";

import { AnimatePresence, motion } from "framer-motion";

const confettiPieces = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${8 + index * 7}%`,
  delay: index * 0.06,
  color: index % 3 === 0 ? "#ff0086" : index % 3 === 1 ? "#3effda" : "#52c1f3",
}));

type CelebrationOverlayProps = {
  show: boolean;
};

export function CelebrationOverlay({ show }: CelebrationOverlayProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-2xl bg-card/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative z-10 text-center"
            initial={{ scale: 0.92, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
          >
            <p className="text-2xl font-semibold text-foreground">
              Gemeinsam geschafft! 🎉
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Zeit, euren Erfolg zu feiern.
            </p>
          </motion.div>
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece.id}
              className="absolute top-1/2 h-2.5 w-2.5 rounded-full"
              style={{ left: piece.left, backgroundColor: piece.color }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -80, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, delay: piece.delay }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
