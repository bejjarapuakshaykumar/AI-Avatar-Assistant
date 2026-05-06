import React, { useRef, useEffect } from 'react';
import { LogEntry, ActionType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface HistorySidebarProps {
  history: LogEntry[];
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ history }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  return (
    <div className="flex flex-col flex-shrink-0 bg-white/5 backdrop-blur-md border-t md:border-t-0 md:border-r border-white/10 w-full h-48 md:w-80 md:h-auto z-20 order-2 md:order-1">
      <div className="p-4 md:p-6 border-b border-white/10 sticky top-0 bg-[#0f172a]/90 backdrop-blur-md z-10 flex justify-between items-center">
        <div>
          <h2 className="text-base md:text-xl font-space font-bold text-white/90">System Log</h2>
          <p className="text-[10px] md:text-xs text-white/40">Real-time operations</p>
        </div>
        <div className="md:hidden text-[10px] text-white/30 uppercase tracking-widest">History</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        <AnimatePresence mode='popLayout'>
          {history.length === 0 && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-white/20 text-center py-4 md:py-10 text-xs md:text-sm italic font-light"
            >
                Awaiting input...
            </motion.div>
          )}
          {history.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-xl border ${
                item.type === 'user' 
                  ? 'bg-white/5 border-white/10 self-end ml-4' 
                  : 'bg-indigo-500/10 border-indigo-500/20 mr-4'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${item.type === 'user' ? 'text-cyan-300' : 'text-indigo-300'}`}>
                    {item.type === 'user' ? 'USER' : 'AURA'}
                </span>
                <span className="text-[10px] text-white/30 font-mono">
                    {item.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </span>
              </div>
              
              <p className="text-xs md:text-sm text-white/80 leading-relaxed font-light font-inter">{item.text}</p>
              
              {item.action && item.action.type !== ActionType.NONE && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center space-x-2 text-[10px] text-emerald-300 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{item.action.type}</span>
                  </div>
                  <a 
                    href={item.action.value} // Manual fallback link
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-white/50 truncate mt-1 hover:text-emerald-400 transition-colors underline decoration-white/20"
                  >
                    {item.action.value}
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
};

export default HistorySidebar;