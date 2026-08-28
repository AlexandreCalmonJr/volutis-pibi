import { setupTestContext, TestReporter } from "../helpers/test-client.js";

export async function runSongsLiturgySuite(): Promise<{ passed: number; failed: number }> {
  const t = new TestReporter("06. Repertório de Louvor, Liturgia & Holyrics");
  const ctx = await setupTestContext();
  const { app, adminAuth } = ctx;

  // 1. Listar catálogo de músicas
  const songsRes = await app.inject({
    method: "GET",
    url: "/api/songs",
    headers: adminAuth,
  });
  t.check("GET /api/songs lista o repertório cadastrado", songsRes.statusCode === 200 && Array.isArray(songsRes.json()));

  // 2. Cadastrar nova música com tom e BPM
  const newSongRes = await app.inject({
    method: "POST",
    url: "/api/songs",
    headers: adminAuth,
    payload: {
      title: "Bondade de Deus (Teste)",
      artist: "Bethel Music / Isaías Saad",
      originalKey: "G",
      bpm: 70,
      chords: "[G] Te amo Deus, Tua graça nunca falha...",
    },
  });
  t.check("POST /api/songs cadastra música com status 201", newSongRes.statusCode === 201);
  const song = newSongRes.json();
  t.check("Música salva com título, tom e bpm", song.title.includes("Bondade") && song.originalKey === "G" && song.bpm === 70);

  // 3. Criar evento para o culto
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7);
  const eventRes = await app.inject({
    method: "POST",
    url: "/api/events",
    headers: adminAuth,
    payload: {
      title: "Culto de Domingo - Louvor & Liturgia",
      type: "SUNDAY_EVENING",
      date: eventDate.toISOString(),
      startTime: eventDate.toISOString(),
    },
  });
  const event = eventRes.json();

  // 4. Adicionar música ao setlist do evento
  const setlistAddRes = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/setlist`,
    headers: adminAuth,
    payload: {
      songId: song.id,
      songKey: "A",
      notes: "Transpor 1 tom acima para a ministração da Ana",
    },
  });
  t.check("POST /api/events/:id/setlist adiciona música ao setlist", setlistAddRes.statusCode === 201);

  // 5. Consultar setlist do evento
  const setlistRes = await app.inject({
    method: "GET",
    url: `/api/events/${event.id}/setlist`,
    headers: adminAuth,
  });
  t.check(
    "GET /api/events/:id/setlist retorna as músicas do culto",
    setlistRes.statusCode === 200 && setlistRes.json().some((item: any) => item.songId === song.id)
  );

  // 6. Cadastrar itens na ordem de culto (Liturgia)
  const liturgy1Res = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/liturgy`,
    headers: adminAuth,
    payload: {
      title: "Oração Inicial e Boas-Vindas",
      startTime: "18:00",
      durationMin: 5,
      responsible: "Pr. Titular",
    },
  });
  const liturgy2Res = await app.inject({
    method: "POST",
    url: `/api/events/${event.id}/liturgy`,
    headers: adminAuth,
    payload: {
      title: "Bloco de Louvor & Adoração",
      startTime: "18:05",
      durationMin: 25,
      responsible: "Equipe de Louvor",
    },
  });
  t.check("POST /api/events/:id/liturgy cria blocos da ordem de culto", liturgy1Res.statusCode === 201 && liturgy2Res.statusCode === 201);

  const lit1 = liturgy1Res.json();
  const lit2 = liturgy2Res.json();

  // 7. Reordenar itens de liturgia
  const reorderRes = await app.inject({
    method: "PUT",
    url: `/api/events/${event.id}/liturgy/reorder`,
    headers: adminAuth,
    payload: {
      itemIds: [lit2.id, lit1.id],
    },
  });
  t.check("PUT /api/events/:id/liturgy/reorder altera a ordem dos blocos", reorderRes.statusCode === 200 && reorderRes.json()[0].id === lit2.id);

  // 8. Consultar configuração do Holyrics
  const holyricsRes = await app.inject({
    method: "GET",
    url: "/api/holyrics/config",
    headers: adminAuth,
  });
  t.check("GET /api/holyrics/config retorna status da integração", holyricsRes.statusCode === 200 && typeof holyricsRes.json().configured === "boolean");

  return t.summary();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("06-songs-liturgy.test.ts")) {
  const summary = await runSongsLiturgySuite();
  process.exit(summary.failed > 0 ? 1 : 0);
}
