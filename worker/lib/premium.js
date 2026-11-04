// Único lugar donde se activa o quita premium.
// Siempre deja consistentes users/{uid}.premium y plans/{uid}.daysUnlocked:
//   premium → 7 días · sin premium → 3 días (salvo clientes de coach: el coach decide sus días).
// Devuelve { cambio } para saber si pasó de gratis a premium (o al revés) y no repetir correos.

export async function cargarUsuario(db, uid) {
  const snap = await db.get(`users/${uid}`);
  return snap ? { id: uid, data: snap.data || {} } : null;
}

export async function aplicarPremium(db, user, activo, campos = {}) {
  const antes = user.data?.premium === true;
  await db.update(`users/${user.id}`, { premium: activo, premiumUpdatedAt: Date.now(), ...campos });

  const plan = await db.get(`plans/${user.id}`);
  if (plan) {
    const dias = activo ? 7 : (user.data?.modalidad === 'coach' ? null : 3);
    if (dias !== null && plan.data?.daysUnlocked !== dias) {
      await db.update(`plans/${user.id}`, { daysUnlocked: dias });
    }
  }
  return { cambio: antes !== activo };
}
