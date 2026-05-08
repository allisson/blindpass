import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  show: boolean;
  isMobile: boolean;
  mobileHideList: boolean;
  children: ReactNode;
}

const TRANSITION = {
  type: 'tween' as const,
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export function ListPanelAnimator({ show, isMobile, mobileHideList, children }: Props) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="vault-list"
          initial={{
            opacity: 0,
            x: isMobile && mobileHideList ? '-100%' : -8,
          }}
          animate={{
            opacity: 1,
            x: isMobile && mobileHideList ? '-100%' : 0,
          }}
          exit={{
            opacity: 0,
            x: isMobile ? '-100%' : -8,
          }}
          transition={TRANSITION}
          className="glass-list-panel border-r-0 md:border-r absolute inset-0 md:static md:inset-auto md:w-72 md:shrink-0 flex flex-col"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MainAnimatorProps {
  isMobile: boolean;
  showListPanel: boolean;
  mobileHideList: boolean;
  children: ReactNode;
}

export function MainAnimator({
  isMobile,
  showListPanel,
  mobileHideList,
  children,
}: MainAnimatorProps) {
  const slideOut = isMobile && showListPanel && !mobileHideList;
  return (
    <motion.main
      className="absolute inset-0 md:static md:inset-auto md:flex-1 overflow-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
      initial={{ x: slideOut ? '100%' : 0 }}
      animate={{ x: slideOut ? '100%' : 0 }}
      transition={TRANSITION}
    >
      {children}
    </motion.main>
  );
}
