import { motion } from 'framer-motion'

const StatCard = ({ label, value, change, icon: Icon, color }) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass rounded-3xl p-6 border border-white/[0.08] relative overflow-hidden group cursor-pointer hover:border-white/[0.12] transition-all duration-300"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-500/5 to-primary-600/5 rounded-full blur-2xl group-hover:blur-3xl transition-all opacity-50 group-hover:opacity-70" />
      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className={`p-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] ${color} backdrop-blur-sm`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${change.startsWith('+') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'} tracking-tight`}>
            {change}
          </span>
        </div>
        <h3 className="text-3xl font-semibold mb-2 tracking-tight">{value}</h3>
        <p className="text-sm text-white/60 tracking-tight">{label}</p>
      </div>
    </motion.div>
  )
}

export default StatCard
