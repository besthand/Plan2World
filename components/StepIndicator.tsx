import React from 'react';
import { AppStep } from '../types';
import { STEPS } from '../constants';

interface Props {
  currentStep: AppStep;
}

const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-700 -z-10 rounded" />
        <div 
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded transition-all duration-500"
          style={{ width: `${(currentIndex / (STEPS.length - 1)) * 100}%` }}
        />

        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 bg-slate-900 px-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2 
                  ${isCompleted ? 'bg-blue-500 border-blue-500 text-white' : 
                    isCurrent ? 'bg-slate-900 border-blue-500 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                    'bg-slate-800 border-slate-600 text-slate-500'}`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className={`text-xs font-medium ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
