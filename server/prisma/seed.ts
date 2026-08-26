import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const j = (a: string[]) => JSON.stringify(a);

async function main() {
  const church = await prisma.church.upsert({
    where: { slug: "pibi" },
    update: {},
    create: {
      name: "Primeira Igreja Batista de Itapuã",
      slug: "pibi",
      holyricsMode: "local",
      holyricsLocalPort: 8091,
    },
  });

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@pibi.org.br" },
    update: {},
    create: {
      email: "admin@pibi.org.br",
      passwordHash: await bcrypt.hash("pibi2026", 10),
      role: "ADMIN",
      member: {
        create: { name: "Administrador PIBI", churchId: church.id },
      },
    },
  });

  // Ministérios com funções
  const ministries: Array<{ name: string; icon: string; color: string; roles: string[] }> = [
    { name: "Louvor", icon: "🎵", color: "#8b5cf6", roles: ["Vocal", "Bateria", "Baixo", "Guitarra", "Violão", "Teclado", "Ministro"] },
    { name: "Mídia/Projeção", icon: "📽️", color: "#3b82f6", roles: ["Operador Holyrics", "Câmera 1", "Câmera 2", "Diretor de Corte"] },
    { name: "Som/Áudio", icon: "🎚️", color: "#f59e0b", roles: ["Mesa de Som", "Monitor/Retorno"] },
    { name: "Transmissão", icon: "📡", color: "#ef4444", roles: ["Operador de Live", "Chat/Moderação"] },
    { name: "Recepção", icon: "🤝", color: "#10b981", roles: ["Recepcionista", "Estacionamento"] },
    { name: "Infantil/Kids", icon: "🧒", color: "#ec4899", roles: ["Professor", "Auxiliar", "Berçário"] },
    { name: "Diaconia", icon: "🍞", color: "#6366f1", roles: ["Diácono de Plantão", "Santa Ceia"] },
    { name: "Staff", icon: "👥", color: "#64748b", roles: ["Coordenador", "Auxiliar", "Planejamento", "Logística"] },
  ];

  for (const m of ministries) {
    const existing = await prisma.ministry.findFirst({
      where: { name: m.name, churchId: church.id },
    });
    if (existing) continue;
    await prisma.ministry.create({
      data: {
        name: m.name,
        icon: m.icon,
        color: m.color,
        churchId: church.id,
        roles: { create: m.roles.map((name) => ({ name })) },
      },
    });
  }

  // Voluntários de exemplo
  const volunteers = [
    { name: "João Silva", email: "joao@pibi.org.br", phone: "71999990001", instruments: ["Violão", "Vocal"] },
    { name: "Maria Santos", email: "maria@pibi.org.br", phone: "71999990002", instruments: ["Teclado"] },
    { name: "Pedro Oliveira", email: "pedro@pibi.org.br", phone: "71999990003", instruments: ["Bateria"] },
  ];
  for (const v of volunteers) {
    await prisma.user.upsert({
      where: { email: v.email },
      update: {},
      create: {
        email: v.email,
        passwordHash: await bcrypt.hash("volutis123", 10),
        role: "VOLUNTEER",
        member: {
          create: {
            name: v.name,
            phone: v.phone,
            instruments: j(v.instruments),
            churchId: church.id,
          },
        },
      },
    });
  }

  // Eventos recorrentes das próximas 4 semanas
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
  const count = await prisma.event.count({ where: { churchId: church.id } });
  if (count === 0) {
    for (let week = 0; week < 4; week++) {
      const sunday = new Date(nextSunday);
      sunday.setDate(nextSunday.getDate() + week * 7);
      const morning = new Date(sunday); morning.setHours(9, 0, 0, 0);
      const evening = new Date(sunday); evening.setHours(19, 0, 0, 0);
      const wednesday = new Date(sunday); wednesday.setDate(sunday.getDate() + 3); wednesday.setHours(19, 30, 0, 0);

      await prisma.event.createMany({
        data: [
          { title: "Culto Domingo Manhã", type: "SUNDAY_MORNING", date: sunday, startTime: morning, isRecurrent: true, recurrence: "weekly:sunday", churchId: church.id },
          { title: "Culto Domingo Noite", type: "SUNDAY_EVENING", date: sunday, startTime: evening, isRecurrent: true, recurrence: "weekly:sunday", churchId: church.id },
          { title: "Culto de Oração", type: "WEDNESDAY_PRAYER", date: wednesday, startTime: wednesday, isRecurrent: true, recurrence: "weekly:wednesday", churchId: church.id },
        ],
      });
    }
  }

  // Repertório inicial
  const songCount = await prisma.song.count({ where: { churchId: church.id } });
  if (songCount === 0) {
    await prisma.song.createMany({
      data: [
        {
          title: "Grande É o Senhor", artist: "Adhemar de Campos", originalKey: "G", bpm: 72,
          structure: "Intro - V1 - C - V2 - C - Final",
          chords: "[G]Grande é o Se[D/F#]nhor e mui[Em]to digno de lou[C]vor\n[G]Na cidade do [D/F#]nosso Deus, [Em]Seu santo mon[C]te\n[Am]Alegria de [G/B]toda a ter[C]ra[D]",
          churchId: church.id,
        },
        {
          title: "Oceanos (Onde Meus Pés Podem Falhar)", artist: "Hillsong United", originalKey: "D", bpm: 64,
          structure: "Intro - V1 - C - V2 - C - Ponte x4 - C Final",
          chords: "[Bm]Tua voz me cha[A]ma sobre as [G]águas\nOnde os meus [D]pés podem fa[A]lhar",
          churchId: church.id,
        },
        {
          title: "Bondade de Deus", artist: "Isaías Saad", originalKey: "E", bpm: 68,
          structure: "V1 - C - V2 - C - Ponte - C",
          chords: "[E]Te amo, Deus, [B]Tua graça nunca fa[C#m]lha\nTodos os [A]dias es[E]tou nas Tuas [B]mãos",
          churchId: church.id,
        },
      ],
    });
  }

  console.log("✅ Seed concluído:", {
    igreja: church.name,
    admin: admin.email,
    ministerios: ministries.length,
    voluntarios: volunteers.length,
  });
}

main().finally(() => prisma.$disconnect());
