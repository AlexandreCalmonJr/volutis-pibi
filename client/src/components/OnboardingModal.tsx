import { useState, useEffect } from "react";
import { useAuth } from "../store";
import { api } from "../api";

interface Step {
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  description: string;
  tips: string[];
}

const STEPS: Step[] = [
  {
    badge: "Bem-vindo ao Volutis PIBI 🙌",
    title: "Sua jornada no ministério começa aqui!",
    subtitle: "Tudo o que você precisa para servir com excelência na igreja em um único lugar.",
    icon: "⛪",
    description: "Este aplicativo foi feito especialmente para facilitar o acesso às suas escalas, repertórios, avisos e comunicação com a liderança.",
    tips: [
      "Acesso rápido pelo celular ou computador",
      "Funciona offline como PWA instalado",
      "Notificações instantâneas de cultos e escalas",
    ],
  },
  {
    badge: "Escalas & Presença 📅",
    title: "Nunca perca um culto escalado",
    subtitle: "Confirme sua presença ou peça trocas com antecedência.",
    icon: "🗓️",
    description: "Na aba Escalas, você confere todos os cultos do mês, quais voluntários estão escalados em cada função e pode responder com 1 clique.",
    tips: [
      "Toque em 'Confirmar' assim que receber uma notificação",
      "Precisa viajar? Solicite troca diretamente para outro voluntário",
      "Exporte suas escalas para o Google Agenda ou Apple Calendar",
    ],
  },
  {
    badge: "Louvor & Músicos 🎵",
    title: "Repertório, Cifras e Ensaio Online",
    subtitle: "Músicas e ferramentas para você chegar afiado no culto.",
    icon: "🎸",
    description: "Acesse as músicas do culto com tom definido, letra, cifra e player de ensaio com YouTube/Spotify.",
    tips: [
      "Ouça a playlist completa do culto no Ensaio Online",
      "Veja anotações de palco, tom e estrutura da música",
      "Acesse letras e links rápidos de cifras do Cifra Club",
    ],
  },
  {
    badge: "Devocional & Notificações 📲",
    title: "Alimente sua fé e fique por dentro",
    subtitle: "Ative os avisos na tela de bloqueio do seu celular.",
    icon: "✨",
    description: "Todos os dias você recebe um Versículo do Dia com reflexão para abençoar sua caminhada. Ative as notificações no Perfil para receber lembretes automáticos.",
    tips: [
      "Compartilhe o versículo do dia no WhatsApp da equipe",
      "Acumule pontos de serviço no ranking de voluntários",
      "Mantenha seus dados e fotos de perfil sempre atualizados",
    ],
  },
];

export function OnboardingModal() {
  const user = useAuth((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const completed = localStorage.getItem(`onboarding_completed_${user.id}`);
    if (!completed) {
      setIsOpen(true);
    }
  }, [user]);

  const handleFinish = async () => {
    if (user?.id) {
      localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    }
    setIsOpen(false);
    try {
      await api("/auth/complete-onboarding", { method: "POST" }).catch(() => {});
    } catch {}
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  if (!isOpen) return null;

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Decorative ambient gradient */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

        {/* Step progress pills */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep
                    ? "w-8 bg-violet-600"
                    : idx < currentStep
                    ? "w-3 bg-violet-300 dark:bg-violet-800"
                    : "w-3 bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleFinish}
            className="text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors px-2 py-1 rounded-lg"
          >
            Pular Tour
          </button>
        </div>

        {/* Icon & Badge */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-violet-500/20">
              {step.icon}
            </div>
            <div>
              <span className="inline-block px-3 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 text-xs font-bold mb-1">
                {step.badge}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-ink)] leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>
                {step.title}
              </h2>
            </div>
          </div>

          <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
            {step.subtitle}
          </p>

          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Bullet points */}
        <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            💡 Destaques:
          </p>
          <ul className="space-y-1.5">
            {step.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-ink)] font-medium">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 transition-all cursor-pointer"
          >
            ← Voltar
          </button>

          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white text-xs sm:text-sm font-bold shadow-lg shadow-violet-500/25 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            {currentStep === STEPS.length - 1 ? (
              <>Começar a Usar 🚀</>
            ) : (
              <>Próximo →</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
