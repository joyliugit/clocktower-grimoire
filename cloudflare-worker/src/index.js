const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const ROOM_TTL_SECONDS = 60 * 60 * 24 * 14;
const CARD_TTL_SECONDS = 60 * 60 * 24 * 3;

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, { status });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function sanitizeRoomCode(value) {
  return `${value || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

function randomId() {
  return crypto.randomUUID();
}

function randomRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, value => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join('');
}

function roomMetaKey(roomCode) {
  return `room:${sanitizeRoomCode(roomCode)}:meta`;
}

function roomPrefix(roomCode) {
  return `room:${sanitizeRoomCode(roomCode)}:`;
}

function playerKey(roomCode, clientId) {
  return `room:${sanitizeRoomCode(roomCode)}:player:${clientId}`;
}

function playerPrefix(roomCode) {
  return `room:${sanitizeRoomCode(roomCode)}:player:`;
}

function cardKey(roomCode, clientId) {
  return `room:${sanitizeRoomCode(roomCode)}:card:${clientId}`;
}

async function listAllKeys(kv, prefix) {
  const keys = [];
  let cursor = undefined;
  do {
    const page = await kv.list({ prefix, cursor, limit: 1000 });
    keys.push(...page.keys.map(item => item.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

async function getRoomMeta(env, roomCode) {
  const code = sanitizeRoomCode(roomCode);
  if (!code) return null;
  return env.ROOMS_KV.get(roomMetaKey(code), 'json');
}

async function putRoomMeta(env, roomMeta) {
  const nextMeta = {
    ...roomMeta,
    code: sanitizeRoomCode(roomMeta.code),
    updatedAt: Date.now()
  };
  await env.ROOMS_KV.put(roomMetaKey(nextMeta.code), JSON.stringify(nextMeta), {
    expirationTtl: ROOM_TTL_SECONDS
  });
  return nextMeta;
}

async function getPlayer(env, roomCode, clientId) {
  if (!clientId) return null;
  return env.ROOMS_KV.get(playerKey(roomCode, clientId), 'json');
}

async function putPlayer(env, roomCode, player) {
  const nextPlayer = {
    ...player,
    updatedAt: Date.now()
  };
  await env.ROOMS_KV.put(playerKey(roomCode, nextPlayer.clientId), JSON.stringify(nextPlayer), {
    expirationTtl: ROOM_TTL_SECONDS
  });
  return nextPlayer;
}

async function listPlayers(env, roomCode) {
  const keys = await listAllKeys(env.ROOMS_KV, playerPrefix(roomCode));
  const players = await Promise.all(keys.map(key => env.ROOMS_KV.get(key, 'json')));
  return players.filter(Boolean).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

async function deletePlayer(env, roomCode, clientId) {
  await env.ROOMS_KV.delete(playerKey(roomCode, clientId));
}

async function deletePlayerCard(env, roomCode, clientId) {
  await env.ROOMS_KV.delete(cardKey(roomCode, clientId));
}

function findPlayer(players, clientId) {
  return players.find(player => player.clientId === clientId) || null;
}

function findSeatOccupant(players, seatIndex) {
  return players.find(player => player.seatIndex === seatIndex) || null;
}

function buildRoomSummary(meta, players, clientId, role) {
  const viewerPlayer = role === 'player' ? findPlayer(players, clientId) : null;
  const seats = Array.from({ length: meta.seatCount }, (_, index) => {
    const occupant = findSeatOccupant(players, index);
    return {
      index,
      occupied: !!occupant,
      playerName: occupant?.name || '',
      isMine: occupant?.clientId === clientId
    };
  });

  return {
    roomCode: meta.code,
    createdAt: meta.createdAt,
    scriptKey: meta.scriptKey,
    seatCount: meta.seatCount,
    viewerRole: role,
    viewerName: role === 'storyteller' ? '说书人' : (viewerPlayer?.name || ''),
    viewerSeatIndex: viewerPlayer?.seatIndex ?? null,
    seats,
    players: role === 'storyteller'
      ? players.map(player => ({
          id: player.clientId,
          name: player.name,
          seatIndex: player.seatIndex,
          connected: false
        }))
      : [],
    connectedCount: role === 'storyteller' ? players.length + 1 : players.length
  };
}

async function createRoom(env) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomRoomCode();
    const existing = await getRoomMeta(env, code);
    if (existing) continue;
    const meta = await putRoomMeta(env, {
      code,
      createdAt: Date.now(),
      storytellerId: randomId(),
      scriptKey: 'tb',
      seatCount: 0
    });
    return meta;
  }
  throw new Error('Failed to create room code');
}

async function handleCreateRoom(env) {
  const meta = await createRoom(env);
  return jsonResponse({
    ok: true,
    roomCode: meta.code,
    clientId: meta.storytellerId,
    role: 'storyteller',
    summary: buildRoomSummary(meta, [], meta.storytellerId, 'storyteller')
  });
}

async function handleConnect(env, request) {
  const body = await parseJson(request);
  const meta = await getRoomMeta(env, body.roomCode);
  if (!meta) return errorResponse('Room not found', 404);

  const role = body.role === 'storyteller' ? 'storyteller' : 'player';
  if (role === 'storyteller') {
    if (!body.clientId || body.clientId !== meta.storytellerId) return errorResponse('Storyteller auth failed', 403);
    const players = await listPlayers(env, meta.code);
    return jsonResponse({
      ok: true,
      roomCode: meta.code,
      clientId: meta.storytellerId,
      role,
      summary: buildRoomSummary(meta, players, meta.storytellerId, role)
    });
  }

  const playerName = `${body.name || ''}`.trim().slice(0, 24);
  if (!playerName) return errorResponse('Player name is required');

  let player = await getPlayer(env, meta.code, body.clientId);
  if (!player) {
    player = {
      clientId: randomId(),
      name: playerName,
      seatIndex: null,
      joinedAt: Date.now()
    };
  } else {
    player.name = playerName;
  }

  await putPlayer(env, meta.code, player);
  const players = await listPlayers(env, meta.code);
  return jsonResponse({
    ok: true,
    roomCode: meta.code,
    clientId: player.clientId,
    role,
    summary: buildRoomSummary(meta, players, player.clientId, role)
  });
}

async function handleState(env, request) {
  const url = new URL(request.url);
  const meta = await getRoomMeta(env, url.searchParams.get('roomCode'));
  if (!meta) return errorResponse('Room not found', 404);

  const clientId = `${url.searchParams.get('clientId') || ''}`.trim();
  if (!clientId) return errorResponse('Missing clientId');

  const players = await listPlayers(env, meta.code);
  if (clientId === meta.storytellerId) {
    return jsonResponse({ ok: true, summary: buildRoomSummary(meta, players, clientId, 'storyteller') });
  }

  const player = findPlayer(players, clientId);
  if (!player) return errorResponse('Player not found in room', 404);
  return jsonResponse({ ok: true, summary: buildRoomSummary(meta, players, clientId, 'player') });
}

async function handleStorySync(env, request) {
  const body = await parseJson(request);
  const meta = await getRoomMeta(env, body.roomCode);
  if (!meta) return errorResponse('Room not found', 404);
  if (body.clientId !== meta.storytellerId) return errorResponse('Only storyteller can sync room', 403);

  const seatCount = Math.max(0, Math.min(20, Number(body.seatCount) || 0));
  meta.seatCount = seatCount;
  meta.scriptKey = `${body.scriptKey || meta.scriptKey || 'tb'}`.trim() || 'tb';

  const players = await listPlayers(env, meta.code);
  for (const player of players) {
    if (!Number.isInteger(player.seatIndex) || player.seatIndex < seatCount) continue;
    player.seatIndex = null;
    await putPlayer(env, meta.code, player);
    await deletePlayerCard(env, meta.code, player.clientId);
  }

  const nextMeta = await putRoomMeta(env, meta);
  const nextPlayers = await listPlayers(env, meta.code);
  return jsonResponse({ ok: true, summary: buildRoomSummary(nextMeta, nextPlayers, meta.storytellerId, 'storyteller') });
}

async function handleSeat(env, request) {
  const body = await parseJson(request);
  const meta = await getRoomMeta(env, body.roomCode);
  if (!meta) return errorResponse('Room not found', 404);

  const players = await listPlayers(env, meta.code);
  const player = findPlayer(players, body.clientId);
  if (!player) return errorResponse('Player not found in room', 404);

  if (body.seatIndex === null || body.seatIndex === '' || body.seatIndex === undefined) {
    player.seatIndex = null;
    await putPlayer(env, meta.code, player);
    await deletePlayerCard(env, meta.code, player.clientId);
    const nextPlayers = await listPlayers(env, meta.code);
    return jsonResponse({ ok: true, summary: buildRoomSummary(meta, nextPlayers, player.clientId, 'player') });
  }

  const seatIndex = Number(body.seatIndex);
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= meta.seatCount) {
    return errorResponse('Seat index out of range');
  }

  const occupied = findSeatOccupant(players, seatIndex);
  if (occupied && occupied.clientId !== player.clientId) {
    return errorResponse('Seat already occupied', 409);
  }

  player.seatIndex = seatIndex;
  await putPlayer(env, meta.code, player);
  await deletePlayerCard(env, meta.code, player.clientId);
  const nextPlayers = await listPlayers(env, meta.code);
  return jsonResponse({ ok: true, summary: buildRoomSummary(meta, nextPlayers, player.clientId, 'player') });
}

async function handleSendCard(env, request) {
  const body = await parseJson(request);
  const meta = await getRoomMeta(env, body.roomCode);
  if (!meta) return errorResponse('Room not found', 404);
  if (body.clientId !== meta.storytellerId) return errorResponse('Only storyteller can send role cards', 403);

  const seatIndex = Number(body.seatIndex);
  if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= meta.seatCount) {
    return errorResponse('Seat index out of range');
  }

  const players = await listPlayers(env, meta.code);
  const targetPlayer = findSeatOccupant(players, seatIndex);
  if (!targetPlayer) return errorResponse('No player seated there yet', 409);
  if (!body.card || typeof body.card !== 'object') return errorResponse('Missing role card payload');

  const payload = {
    ...body.card,
    roomCode: meta.code,
    seatIndex,
    sentAt: Date.now()
  };

  await env.ROOMS_KV.put(cardKey(meta.code, targetPlayer.clientId), JSON.stringify(payload), {
    expirationTtl: CARD_TTL_SECONDS
  });
  return jsonResponse({ ok: true });
}

async function handleCard(env, request) {
  const url = new URL(request.url);
  const meta = await getRoomMeta(env, url.searchParams.get('roomCode'));
  if (!meta) return errorResponse('Room not found', 404);
  const clientId = `${url.searchParams.get('clientId') || ''}`.trim();
  if (!clientId) return errorResponse('Missing clientId');

  const player = await getPlayer(env, meta.code, clientId);
  if (!player) return errorResponse('Player not found in room', 404);

  const card = await env.ROOMS_KV.get(cardKey(meta.code, clientId), 'json');
  return jsonResponse({ ok: true, card: card || null });
}

async function handleLeave(env, request) {
  const body = await parseJson(request);
  const meta = await getRoomMeta(env, body.roomCode);
  if (!meta) return jsonResponse({ ok: true });

  if (body.clientId === meta.storytellerId) {
    const keys = await listAllKeys(env.ROOMS_KV, roomPrefix(meta.code));
    await Promise.all(keys.map(key => env.ROOMS_KV.delete(key)));
    return jsonResponse({ ok: true, destroyed: true });
  }

  await deletePlayer(env, meta.code, body.clientId);
  await deletePlayerCard(env, meta.code, body.clientId);
  return jsonResponse({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return emptyResponse();

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse({ ok: true, storage: 'workers-kv' });
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/create') {
        return handleCreateRoom(env);
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/connect') {
        return handleConnect(env, request);
      }
      if (request.method === 'GET' && url.pathname === '/api/rooms/state') {
        return handleState(env, request);
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/story-sync') {
        return handleStorySync(env, request);
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/seat') {
        return handleSeat(env, request);
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/send-card') {
        return handleSendCard(env, request);
      }
      if (request.method === 'GET' && url.pathname === '/api/rooms/card') {
        return handleCard(env, request);
      }
      if (request.method === 'POST' && url.pathname === '/api/rooms/leave') {
        return handleLeave(env, request);
      }
      return errorResponse('Not found', 404);
    } catch (error) {
      return errorResponse(error.message || 'Worker error', 500);
    }
  }
};
