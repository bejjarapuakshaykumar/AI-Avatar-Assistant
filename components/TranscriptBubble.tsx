import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptBubbleProps {
  text: string;
  isListening: boolean;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ text, isListening }) => {
  return (
    <div className="absolute top-1/4 left-0 right-0 flex justify-center pointer-events-none z-30">
      <AnimatePresence>
        {(text || isListening) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl max-w-md text-center"
          >
            {isListening && !text ? (
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
            ) : (
                <p className="text-lg font-light text-white font-space">"{text}"</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranscriptBubble;