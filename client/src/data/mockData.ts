export interface Voluntario {
  id: number;
  nome: string;
  ministerio: string;
  funcoes: string[];
  status: "ativo" | "pendente" | "inativo";
  presencas: number;
  faltas: number;
  telefone: string;
  email: string;
  batizado: boolean;
  dataIngresso: string;
  disponibilidade: string[];
}

export interface Evento {
  id: number;
  titulo: string;
  data: string;
  horario: string;
  tipo: string;
  ministerios: string[];
  vagasNecessarias: number;
  voluntariosEscalados: number;
  local: string;
  recorrente: boolean;
}

export interface Musica {
  id: number;
  titulo: string;
  artista: string;
  tom: string;
  tempo: string;
  links: { spotify?: string; youtube?: string };
  ultimaVez: string;
}

export interface Setlist {
  id: number;
  eventoId: number;
  eventoTitulo: string;
  data: string;
  musicas: number[];
  ministerioLider: string;
}

export interface Mensagem {
  id: number;
  autor: string;
  texto: string;
  horario: string;
  ministerio: string;
}

export const ministerios = [
  "Louvor",
  "Mídia",
  "Recepção",
  "Infantil",
  "Jovens",
  "Intercessão",
  "Diaconato",
];

export const voluntarios: Voluntario[] = [
  {
    id: 1,
    nome: "Ana Paula Costa",
    ministerio: "Louvor",
    funcoes: ["Vocal", "Violão"],
    status: "ativo",
    presencas: 18,
    faltas: 2,
    telefone: "+55 11 99234-5678",
    email: "ana.costa@email.com",
    batizado: true,
    dataIngresso: "2022-03-15",
    disponibilidade: ["Domingo manhã", "Domingo noite", "Quarta"],
  },
  {
    id: 2,
    nome: "Carlos Eduardo Silva",
    ministerio: "Mídia",
    funcoes: ["Técnico de Som"],
    status: "ativo",
    presencas: 22,
    faltas: 0,
    telefone: "+55 11 98765-4321",
    email: "carlos.silva@email.com",
    batizado: true,
    dataIngresso: "2021-06-01",
    disponibilidade: ["Domingo manhã", "Domingo noite"],
  },
  {
    id: 3,
    nome: "Beatriz Fernandes",
    ministerio: "Recepção",
    funcoes: ["Recepcionista", "Líder de Acolhimento"],
    status: "ativo",
    presencas: 20,
    faltas: 1,
    telefone: "+55 11 97654-3210",
    email: "beatriz.fernandes@email.com",
    batizado: true,
    dataIngresso: "2020-01-20",
    disponibilidade: ["Domingo manhã", "Domingo noite", "Quarta"],
  },
  {
    id: 4,
    nome: "Rafael Oliveira",
    ministerio: "Mídia",
    funcoes: ["Operador de Slides", "Câmera"],
    status: "ativo",
    presencas: 16,
    faltas: 4,
    telefone: "+55 11 96543-2109",
    email: "rafael.oliveira@email.com",
    batizado: true,
    dataIngresso: "2022-09-10",
    disponibilidade: ["Domingo manhã"],
  },
  {
    id: 5,
    nome: "Mariana Santos",
    ministerio: "Infantil",
    funcoes: ["Professora EBD"],
    status: "ativo",
    presencas: 21,
    faltas: 0,
    telefone: "+55 11 95432-1098",
    email: "mariana.santos@email.com",
    batizado: true,
    dataIngresso: "2019-11-05",
    disponibilidade: ["Domingo manhã", "Quarta"],
  },
  {
    id: 6,
    nome: "João Victor Mendes",
    ministerio: "Louvor",
    funcoes: ["Guitarra", "Contrabaixo"],
    status: "ativo",
    presencas: 19,
    faltas: 3,
    telefone: "+55 11 94321-0987",
    email: "joao.mendes@email.com",
    batizado: true,
    dataIngresso: "2021-02-28",
    disponibilidade: ["Domingo manhã", "Domingo noite"],
  },
  {
    id: 7,
    nome: "Fernanda Lima",
    ministerio: "Recepção",
    funcoes: ["Recepcionista"],
    status: "pendente",
    presencas: 3,
    faltas: 0,
    telefone: "+55 11 93210-9876",
    email: "fernanda.lima@email.com",
    batizado: false,
    dataIngresso: "2024-01-10",
    disponibilidade: ["Domingo manhã"],
  },
  {
    id: 8,
    nome: "Lucas Pereira",
    ministerio: "Mídia",
    funcoes: ["Técnico de Som", "Técnico de Luz"],
    status: "ativo",
    presencas: 17,
    faltas: 3,
    telefone: "+55 11 92109-8765",
    email: "lucas.pereira@email.com",
    batizado: true,
    dataIngresso: "2020-07-14",
    disponibilidade: ["Domingo manhã", "Domingo noite", "Quarta"],
  },
  {
    id: 9,
    nome: "Isabela Rocha",
    ministerio: "Jovens",
    funcoes: ["Liderança", "Vocal"],
    status: "ativo",
    presencas: 23,
    faltas: 0,
    telefone: "+55 11 91098-7654",
    email: "isabela.rocha@email.com",
    batizado: true,
    dataIngresso: "2018-04-22",
    disponibilidade: ["Domingo manhã", "Domingo noite", "Sábado", "Quarta"],
  },
  {
    id: 10,
    nome: "Thiago Almeida",
    ministerio: "Diaconato",
    funcoes: ["Diácono"],
    status: "ativo",
    presencas: 24,
    faltas: 0,
    telefone: "+55 11 90987-6543",
    email: "thiago.almeida@email.com",
    batizado: true,
    dataIngresso: "2016-08-30",
    disponibilidade: ["Domingo manhã", "Domingo noite", "Quarta"],
  },
  {
    id: 11,
    nome: "Priscila Nunes",
    ministerio: "Intercessão",
    funcoes: ["Intercessora"],
    status: "ativo",
    presencas: 20,
    faltas: 1,
    telefone: "+55 11 89876-5432",
    email: "priscila.nunes@email.com",
    batizado: true,
    dataIngresso: "2019-03-07",
    disponibilidade: ["Domingo manhã", "Quarta"],
  },
  {
    id: 12,
    nome: "Gabriel Torres",
    ministerio: "Louvor",
    funcoes: ["Bateria"],
    status: "inativo",
    presencas: 5,
    faltas: 8,
    telefone: "+55 11 88765-4321",
    email: "gabriel.torres@email.com",
    batizado: true,
    dataIngresso: "2021-11-15",
    disponibilidade: [],
  },
];

export const eventos: Evento[] = [
  {
    id: 1,
    titulo: "Culto Domingo Manhã",
    data: "2024-09-01",
    horario: "09:00",
    tipo: "Culto",
    ministerios: ["Louvor", "Mídia", "Recepção", "Infantil"],
    vagasNecessarias: 12,
    voluntariosEscalados: 10,
    local: "Templo Principal",
    recorrente: true,
  },
  {
    id: 2,
    titulo: "Culto Domingo Noite",
    data: "2024-09-01",
    horario: "19:00",
    tipo: "Culto",
    ministerios: ["Louvor", "Mídia", "Recepção"],
    vagasNecessarias: 8,
    voluntariosEscalados: 8,
    local: "Templo Principal",
    recorrente: true,
  },
  {
    id: 3,
    titulo: "Culto de Oração - Quarta",
    data: "2024-09-04",
    horario: "19:30",
    tipo: "Oração",
    ministerios: ["Mídia", "Intercessão"],
    vagasNecessarias: 4,
    voluntariosEscalados: 3,
    local: "Sala de Oração",
    recorrente: true,
  },
  {
    id: 4,
    titulo: "Conferência Jovens 2024",
    data: "2024-09-14",
    horario: "14:00",
    tipo: "Conferência",
    ministerios: ["Louvor", "Mídia", "Recepção", "Jovens"],
    vagasNecessarias: 20,
    voluntariosEscalados: 15,
    local: "Salão de Eventos",
    recorrente: false,
  },
  {
    id: 5,
    titulo: "EBD - Escola Bíblica",
    data: "2024-09-08",
    horario: "08:00",
    tipo: "EBD",
    ministerios: ["Infantil"],
    vagasNecessarias: 6,
    voluntariosEscalados: 5,
    local: "Salas de Aula",
    recorrente: true,
  },
  {
    id: 6,
    titulo: "Batismos",
    data: "2024-09-22",
    horario: "10:30",
    tipo: "Especial",
    ministerios: ["Diaconato", "Mídia", "Louvor"],
    vagasNecessarias: 10,
    voluntariosEscalados: 6,
    local: "Batistério",
    recorrente: false,
  },
];

export const musicas: Musica[] = [
  {
    id: 1,
    titulo: "Oceanos",
    artista: "Hillsong United",
    tom: "A",
    tempo: "72 BPM",
    links: { youtube: "https://youtube.com" },
    ultimaVez: "2024-08-25",
  },
  {
    id: 2,
    titulo: "Ninguém Como Ele",
    artista: "Ministério Zoe",
    tom: "G",
    tempo: "68 BPM",
    links: { spotify: "https://spotify.com", youtube: "https://youtube.com" },
    ultimaVez: "2024-08-18",
  },
  {
    id: 3,
    titulo: "Leão e Cordeiro",
    artista: "Bethel Music",
    tom: "E",
    tempo: "75 BPM",
    links: { youtube: "https://youtube.com" },
    ultimaVez: "2024-08-11",
  },
  {
    id: 4,
    titulo: "Maravilhosa Graça",
    artista: "Diante do Trono",
    tom: "D",
    tempo: "80 BPM",
    links: { spotify: "https://spotify.com" },
    ultimaVez: "2024-07-28",
  },
  {
    id: 5,
    titulo: "Me Rendo",
    artista: "Ministério Apascentar",
    tom: "C",
    tempo: "65 BPM",
    links: {},
    ultimaVez: "2024-08-04",
  },
  {
    id: 6,
    titulo: "Extraordinário",
    artista: "Fernandinho",
    tom: "F#",
    tempo: "90 BPM",
    links: { spotify: "https://spotify.com", youtube: "https://youtube.com" },
    ultimaVez: "2024-09-01",
  },
  {
    id: 7,
    titulo: "Vem, Espírito",
    artista: "Isaias Saad",
    tom: "B♭",
    tempo: "70 BPM",
    links: { youtube: "https://youtube.com" },
    ultimaVez: "2024-07-14",
  },
  {
    id: 8,
    titulo: "Yaweh",
    artista: "Jesus Culture",
    tom: "D",
    tempo: "85 BPM",
    links: { spotify: "https://spotify.com" },
    ultimaVez: "2024-06-30",
  },
];

export const setlists: Setlist[] = [
  {
    id: 1,
    eventoId: 1,
    eventoTitulo: "Culto Domingo Manhã",
    data: "2024-09-01",
    musicas: [2, 6, 1, 5],
    ministerioLider: "Ana Paula Costa",
  },
  {
    id: 2,
    eventoId: 2,
    eventoTitulo: "Culto Domingo Noite",
    data: "2024-09-01",
    musicas: [3, 7, 4],
    ministerioLider: "João Victor Mendes",
  },
  {
    id: 3,
    eventoId: 4,
    eventoTitulo: "Conferência Jovens 2024",
    data: "2024-09-14",
    musicas: [6, 1, 8, 3, 2],
    ministerioLider: "Isabela Rocha",
  },
];

export const mensagens: Mensagem[] = [
  {
    id: 1,
    autor: "Ana Paula Costa",
    texto: "Pessoal, vamos confirmar a presença no ensaio de sexta?",
    horario: "10:32",
    ministerio: "Louvor",
  },
  {
    id: 2,
    autor: "João Victor Mendes",
    texto: "Eu confirmo! Já deixei na agenda.",
    horario: "10:45",
    ministerio: "Louvor",
  },
  {
    id: 3,
    autor: "Carlos Eduardo Silva",
    texto: "O sistema de som foi atualizado. Novo setup disponível.",
    horario: "09:15",
    ministerio: "Mídia",
  },
  {
    id: 4,
    autor: "Beatriz Fernandes",
    texto: "Precisamos de mais 2 recepcionistas para o domingo de manhã!",
    horario: "08:50",
    ministerio: "Recepção",
  },
  {
    id: 5,
    autor: "Isabela Rocha",
    texto: "Lembrete: reunião de líderes na quarta às 19h antes do culto.",
    horario: "11:00",
    ministerio: "Jovens",
  },
];

export const notificacoes = [
  {
    id: 1,
    tipo: "whatsapp",
    descricao: "Confirmação de escala enviada para 8 voluntários",
    horario: "Há 2 horas",
    status: "enviado",
  },
  {
    id: 2,
    tipo: "lembrete",
    descricao: "Lembrete automático enviado: Culto Domingo Manhã",
    horario: "Há 4 horas",
    status: "enviado",
  },
  {
    id: 3,
    tipo: "disponibilidade",
    descricao: "Consulta de disponibilidade de setembro enviada",
    horario: "Ontem",
    status: "aguardando",
  },
  {
    id: 4,
    tipo: "troca",
    descricao: "Rafael Oliveira solicitou substituição em 08/09",
    horario: "Há 1 dia",
    status: "pendente",
  },
];

export const feedbackData = [
  { mes: "Mar", score: 4.2 },
  { mes: "Abr", score: 4.5 },
  { mes: "Mai", score: 4.3 },
  { mes: "Jun", score: 4.7 },
  { mes: "Jul", score: 4.6 },
  { mes: "Ago", score: 4.8 },
];

export const presencaData = [
  { ministerio: "Louvor", presenca: 88 },
  { ministerio: "Mídia", presenca: 92 },
  { ministerio: "Recepção", presenca: 85 },
  { ministerio: "Infantil", presenca: 94 },
  { ministerio: "Jovens", presenca: 79 },
  { ministerio: "Intercessão", presenca: 90 },
];
