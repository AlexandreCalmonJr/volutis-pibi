import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../api";

interface Ministry {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  roles: { id: string; name: string }[];
}

interface ChurchData {
  id: string;
  name: string;
  slug: string;
  ministries: Ministry[];
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  photoUrl: string;
  instruments: string[];
  availability: Record<string, string[]>;
  ministryIds: string[];
}

const DAYS = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const TIME_SLOTS = [
  { key: "morning", label: "Manhã (6h-12h)" },
  { key: "afternoon", label: "Tarde (12h-18h)" },
  { key: "evening", label: "Noite (18h-23h)" },
];

export default function CadastroPage() {
  const { slug } = useParams<{ slug: string }>();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    photoUrl: "",
    instruments: [],
    availability: {},
    ministryIds: [],
  });

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_URL}/api/applications/church/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setChurch(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Igreja não encontrada");
        setLoading(false);
      });
  }, [slug]);

  const toggleMinistry = (id: string) => {
    setForm((prev) => ({
      ...prev,
      ministryIds: prev.ministryIds.includes(id)
        ? prev.ministryIds.filter((i) => i !== id)
        : [...prev.ministryIds, id],
    }));
  };

  const toggleDay = (day: string, slot: string) => {
    setForm((prev) => {
      const current = prev.availability[day] || [];
      const updated = current.includes(slot)
        ? current.filter((s) => s !== slot)
        : [...current, slot];
      return {
        ...prev,
        availability: { ...prev.availability, [day]: updated },
      };
    });
  };

  const handleSubmit = async () => {
    if (!church) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/applications?church=${church.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          photoUrl: form.photoUrl || undefined,
          instruments: form.instruments,
          availability: Object.keys(form.availability).length > 0 ? form.availability : undefined,
          ministryIds: form.ministryIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar cadastro");

      setSuccess(true);
    } catch (e: any) {
      setError(e.message || "Erro ao enviar cadastro");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error && !church) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Cadastro realizado!</h1>
          <p className="text-gray-600 mb-4">
            Seu pedido de cadastro foi enviado com sucesso. O líder do ministério irá analisar seu pedido e você receberá uma notificação quando for aprovado(a).
          </p>
          {form.phone && (
            <p className="text-sm text-gray-500">
              Você receberá uma confirmação via WhatsApp em breve.
            </p>
          )}
        </div>
      </div>
    );
  }

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-purple-600">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'Fraunces', serif" }}>
            {church?.name}
          </h1>
          <p className="text-gray-600 mt-1">Cadastro de Voluntários</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Passo {step} de {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Dados Pessoais */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Dados Pessoais</h2>
                <p className="text-sm text-gray-600">Preencha suas informações básicas</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Telefone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(71) 99999-9999"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Foto (URL)
                </label>
                <input
                  type="url"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Instrumentos / Habilidades
                </label>
                <input
                  type="text"
                  value={form.instruments.join(", ")}
                  onChange={(e) => setForm({ ...form, instruments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Ex: Violão, Vocal, Piano..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">Separe por vírgula</p>
              </div>
            </div>
          )}

          {/* Step 2: Ministérios */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Ministérios de Interesse</h2>
                <p className="text-sm text-gray-600">Selecione o(s) ministério(s) que deseja servir</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {church?.ministries.map((m) => {
                  const selected = form.ministryIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMinistry(m.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{m.icon || "⛪"}</span>
                        <div>
                          <p className="font-semibold text-gray-800">{m.name}</p>
                          <p className="text-xs text-gray-500">
                            {m.roles.length} função(ões)
                          </p>
                        </div>
                        {selected && (
                          <div className="ml-auto w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {form.ministryIds.length > 0 && (
                <div className="p-3 bg-purple-50 rounded-xl">
                  <p className="text-sm text-purple-700">
                    {form.ministryIds.length} ministério(s) selecionado(s)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Disponibilidade */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Disponibilidade</h2>
                <p className="text-sm text-gray-600">Quando você pode servir?</p>
              </div>

              <div className="space-y-4">
                {DAYS.map((day) => (
                  <div key={day.key} className="border border-gray-200 rounded-xl p-4">
                    <p className="font-medium text-gray-800 mb-3">{day.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map((slot) => {
                        const selected = form.availability[day.key]?.includes(slot.key);
                        return (
                          <button
                            key={slot.key}
                            onClick={() => toggleDay(day.key, slot.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              selected
                                ? "bg-purple-500 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(form.availability).length > 0 && (
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-sm text-green-700">
                    Disponibilidade registrada!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                onClick={() => {
                  if (step === 1 && !form.name) {
                    setError("Preencha o nome completo");
                    return;
                  }
                  if (step === 2 && form.ministryIds.length === 0) {
                    setError("Selecione pelo menos um ministério");
                    return;
                  }
                  setError("");
                  setStep(step + 1);
                }}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {submitting ? "Enviando..." : "Enviar Cadastro"}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Powered by Volutis PIBI
        </p>
      </div>
    </div>
  );
}
