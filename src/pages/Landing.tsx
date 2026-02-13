import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Trophy, Users, PlayCircle, Video, BarChart3, Target,
  ArrowRight, Shield, Zap, Brain, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: PlayCircle, title: "Interactive Playbooks", desc: "Design plays with visual court diagrams and step-by-step sequences" },
  { icon: Brain, title: "AI Coaching Assistant", desc: "Get intelligent suggestions for play improvements and strategy" },
  { icon: Video, title: "Video Library", desc: "Upload, organize, and review game film with your team" },
  { icon: BarChart3, title: "Team Analytics", desc: "Track performance metrics and identify areas for improvement" },
  { icon: Target, title: "Whiteboard Mode", desc: "Quick drawing tool for timeouts and in-game adjustments" },
  { icon: Users, title: "Team Management", desc: "Manage roster, assign roles, and coordinate practice plans" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">Playbook Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gradient-primary">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            <span>The Complete Coaching Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Transform Your
            <span className="gradient-text block">Basketball Team</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Design plays, manage videos, track performance, and elevate your coaching
            with AI-powered insights. Built for coaches who demand excellence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-lg px-8 py-6 rounded-xl group">
                Start Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-success rounded-full" /> AI-powered</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary rounded-full" /> Free to start</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Everything You Need to Win</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional-grade tools for basketball coaching at every level
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-6 border hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="gradient-primary rounded-3xl p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to Elevate Your Game?</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Join coaches who are already using Playbook Pro to transform their teams
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6 rounded-xl group">
              Get Started Free
              <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
