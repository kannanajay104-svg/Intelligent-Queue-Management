export function calculateAverageServiceTime(completedTokens, fallback) {
  const fallbackVal = Number.isFinite(Number(fallback)) && Number(fallback) > 0 ? Number(fallback) : 10;
  // Exclude sub-15s clicks and extreme overnight/multiday outliers (>45 min or >3x standard duration)
  const maxAllowed = Math.max(30, fallbackVal * 3);
  const durations = completedTokens
    .map((token) => token.serviceDuration)
    .filter((value) => Number.isFinite(value) && value >= 0.25 && value <= maxAllowed);

  if (!durations.length) return fallbackVal;
  const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  return Math.round(average * 10) / 10;
}

export function calculateServiceDuration(start, end) {
  const diffMinutes = (new Date(end) - new Date(start)) / 60000;
  // Cap at realistic maximum 30 mins if token was left open overnight
  if (diffMinutes > 120) return 15;
  return Math.max(0, diffMinutes);
}

export function calculateActualWaitingTime(created, start) {
  return Math.max(0, (new Date(start) - new Date(created)) / 60000);
}

export function calculateRemainingServiceTime(serviceMinutes, activeToken, lateFallbackMinutes = serviceMinutes, now = Date.now()) {
  const assignedMinutes = Number.isFinite(Number(serviceMinutes)) && Number(serviceMinutes) > 0 ? Number(serviceMinutes) : 0;
  const lateFallback = Number.isFinite(Number(lateFallbackMinutes)) && Number(lateFallbackMinutes) > 0 ? Number(lateFallbackMinutes) : assignedMinutes;
  if (!activeToken?.serviceStartTime) return assignedMinutes;
  const elapsed = Math.max(0, (now - new Date(activeToken.serviceStartTime).getTime()) / 60000);
  if (elapsed <= assignedMinutes) return Math.max(0, assignedMinutes - elapsed);
  return Math.max(1, lateFallback - elapsed);
}

export function calculateWaitingTime(peopleAhead, assignedMinutes, activeToken, lateFallbackMinutes = assignedMinutes, now = Date.now()) {
  const waitingAhead = Math.max(0, Number(peopleAhead) || 0);
  const assignedDuration = Number.isFinite(Number(assignedMinutes)) && Number(assignedMinutes) > 0 ? Number(assignedMinutes) : 0;
  const activeRemaining = activeToken ? calculateRemainingServiceTime(assignedDuration, activeToken, lateFallbackMinutes, now) : 0;
  const waitingCustomersAhead = activeToken ? Math.max(0, waitingAhead - 1) : waitingAhead;
  return Math.max(0, Math.round(activeRemaining + waitingCustomersAhead * assignedDuration));
}

export async function buildQueue({ Token, service, includeCompleted = true }) {
  const activeStatuses = ['WAITING', 'CALLED', 'IN_PROGRESS'];
  const active = await Token.find({ service: service._id, status: { $in: activeStatuses } }).sort({ tokenCreatedAt: 1 });
  const completed = includeCompleted ? await Token.find({ service: service._id, status: 'COMPLETED', serviceDuration: { $gt: 0 } }).sort({ serviceEndTime: -1 }).limit(100) : [];
  const average = calculateAverageServiceTime(completed, service.averageServiceDuration);
  const assignedDuration = Number.isFinite(Number(service.averageServiceDuration)) && Number(service.averageServiceDuration) > 0
    ? Number(service.averageServiceDuration)
    : 0;
  const lateFallbackDuration = Math.max(assignedDuration, Number(average) || 0);
  const current = active.find((token) => token.status === 'IN_PROGRESS') || null;
  const waiting = active.filter((token) => token.status !== 'IN_PROGRESS');
  const queue = waiting.map((token, index) => ({
    tokenId: token._id,
    tokenNumber: token.tokenNumber,
    queuePosition: index + 1,
    peopleAhead: index + (current ? 1 : 0),
    estimatedWaitingTime: calculateWaitingTime(index + (current ? 1 : 0), assignedDuration, current, lateFallbackDuration),
    status: token.status
  }));
  return {
    currentToken: current?.tokenNumber || null,
    currentTokenId: current?._id || null,
    currentRemainingServiceTime: current ? calculateRemainingServiceTime(assignedDuration, current, lateFallbackDuration) : 0,
    currentServiceRunningLate: Boolean(current?.serviceStartTime && (Date.now() - new Date(current.serviceStartTime).getTime()) / 60000 > assignedDuration),
    averageServiceDuration: Math.round(average * 100) / 100,
    assignedServiceDuration: assignedDuration,
    queue
  };
}
