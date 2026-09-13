'use client';
import { TrendingUp, X } from 'lucide-react';
import { useLearner } from './LearnerProvider';
export function AdaptiveToast() {
  const { toast, dismissToast } = useLearner();
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {toast && (
        <div key={toast.id} className="adaptive-toast">
          <span className="toast-icon">
            <TrendingUp size={19} aria-hidden="true" />
          </span>
          <p>{toast.text}</p>
          <button className="icon-button" onClick={dismissToast} aria-label="Dismiss notification">
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
