import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
const INSTANT = { duration: 0 };

export function ListPanelAnimator({ show, isMobile, mobileHideList, children }: Props) {
  const reduceMotion = useReducedMotion();
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
          transition={reduceMotion ? INSTANT : TRANSITION}
          className="solid-panel border-r absolute inset-0 flex flex-col"
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
  const reduceMotion = useReducedMotion();
  const slideOut = isMobile && showListPanel && !mobileHideList;
  return (
    <motion.main
      className="absolute inset-0 overflow-auto"
      initial={{ x: slideOut ? '100%' : 0 }}
      animate={{ x: slideOut ? '100%' : 0 }}
      transition={reduceMotion ? INSTANT : TRANSITION}
    >
      {children}
    </motion.main>
  );
}
