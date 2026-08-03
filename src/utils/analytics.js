import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase';

export const track = (eventName, params = {}) => {
  try { logEvent(analytics, eventName, params); } catch(e) {}
};
