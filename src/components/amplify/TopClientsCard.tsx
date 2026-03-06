import React from 'react';
import { Users, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

export interface TopClient {
  username: string;
  comment: string;
  intentScore: number;
}

interface TopClientsCardProps {
  clients: TopClient[];
}

export const TopClientsCard: React.FC<TopClientsCardProps> = ({ clients = [] }) => {
  return (
    <div className="brutalist-card p-8 flex flex-col h-full !bg-white">
      <div className="flex justify-between items-start mb-8">
        <span className="pill-badge !bg-black !text-white !border-black scale-110 origin-left !shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          TOP POTENTIAL CLIENTS
        </span>
        <Users size={24} className="text-black" />
      </div>

      <h3 className="text-3xl font-black text-black mb-2 tracking-tighter uppercase">High Intent Leads</h3>
      <p className="text-sm font-black text-black/60 mb-8 uppercase tracking-widest">
        Users expressing clear purchase intent
      </p>

      {clients.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border-4 border-dashed border-black/20 text-center">
          <Users size={40} className="text-black/20 mb-4" />
          <p className="text-black/60 font-black uppercase text-sm">No high-intent comments detected yet.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 space-y-4">
          {clients.map((client, i) => (
            <motion.div
              key={client.username + i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:-translate-x-1 transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <a
                  href={`https://instagram.com/${client.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-black text-lg underline decoration-accent decoration-4 flex items-center gap-1 hover:text-accent transition-colors"
                  title="View Instagram Profile"
                >
                  @{client.username} <ExternalLink size={14} className="text-black" />
                </a>
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2 py-1 border-2 border-emerald-800">
                  Intent Score: {client.intentScore}
                </span>
              </div>
              <p className="text-sm text-black/80 font-bold break-words border-l-4 border-black/20 pl-3 italic">
                "{client.comment}"
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
