import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";

interface DevotionalItem {
  id: string;
  reference: string;
  verse: string;
  title: string;
  reflection: string;
  theme: string;
  author: string;
  date: string;
}

const CURATED_DEVOTIONALS: Omit<DevotionalItem, "id" | "date">[] = [
  {
    title: "Servindo com Excelência e Alegria",
    reference: "Colossenses 3:23-24",
    verse: "Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens, sabendo que receberão do Senhor a recompensa da herança.",
    reflection: "Nosso serviço na igreja — seja na recepção, na mídia, no louvor ou na diaconia — é uma oferta viva de adoração. Cada detalhe importa para o Reino.",
    theme: "Serviço & Propósito",
    author: "Ministério Volutis PIBI",
  },
  {
    title: "Cantem ao Senhor um Cântico Novo",
    reference: "Salmos 33:3",
    verse: "Cantem-lhe um cântico novo; toquem com habilidade ao aclamá-lo.",
    reflection: "A música e a arte na igreja unem a excelência da técnica à pureza do coração. Toque e cante para a glória do Pai.",
    theme: "Louvor & Adoração",
    author: "Ministério de Louvor PIBI",
  },
  {
    title: "Firmeza e Dedicação Constante",
    reference: "1 Coríntios 15:58",
    verse: "Portanto, meus amados irmãos, mantenham-se firmes, e que nada os abale. Sejam sempre dedicados à obra do Senhor, pois vocês sabem que, no Senhor, o trabalho de vocês não será inútil.",
    reflection: "Mesmo nos dias cansativos, lembre-se: nenhuma escala e nenhum ato de dedicação passa despercebido aos olhos de Deus.",
    theme: "Perseverança",
    author: "Liderança PIBI",
  },
  {
    title: "Alegria no Serviço",
    reference: "Salmos 100:2",
    verse: "Prestem culto ao Senhor com alegria; entrem na sua presença com cânticos alegres.",
    reflection: "Servir a Deus não é um fardo, mas o maior privilégio da nossa vida cristã. Que sua alegria contagie toda a congregação hoje.",
    theme: "Alegria",
    author: "Família PIBI",
  },
  {
    title: "Fervor no Espírito",
    reference: "Romanos 12:11",
    verse: "Nunca lhes falte o zelo, sejam fervorosos no espírito, sirvam ao Senhor.",
    reflection: "Mantenha a chama do Espírito acesa através da oração e da comunhão antes de cada ministração e culto.",
    theme: "Espiritualidade",
    author: "Devocional Diário",
  },
  {
    title: "Deus Lembra do Seu Amor",
    reference: "Hebreus 6:10",
    verse: "Deus não é injusto; ele não se esquecerá do trabalho de vocês e do amor que demonstraram por ele, ao ajudar os santos.",
    reflection: "O Senhor vê sua disposição de chegar mais cedo, carregar cabos, ensaiar e orar pelos irmãos. Ele é o seu galardoador.",
    theme: "Recompensa Divina",
    author: "Devocional Diário",
  },
];

export async function devotionalRoutes(app: FastifyInstance) {
  app.get("/devotional/daily", { preHandler: [requireAuth] }, async (_req, reply) => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const selected = CURATED_DEVOTIONALS[dayOfYear % CURATED_DEVOTIONALS.length];

    const todayStr = today.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    return reply.send({
      id: `devotional-${today.toISOString().split("T")[0]}`,
      ...selected,
      date: todayStr,
    });
  });
}
