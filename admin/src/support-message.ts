export function supportMessageIsSupport(message: Record<string, unknown>, supportProfile: Record<string, unknown> = {}) {
  const role = String(message.senderRole ?? message.sender_role ?? "").trim().toUpperCase();
  if (role) return role === "SUPPORT";
  const senderId = String(message.senderProfileId ?? message.sender_profile_id ?? "").trim();
  const supportId = String(supportProfile.id ?? "").trim();
  return Boolean(senderId && supportId && senderId === supportId);
}
