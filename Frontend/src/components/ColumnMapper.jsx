import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const ROLES = [
  { key: 'caseNumber', label: 'Case ID / Number', required: true },
  { key: 'subject', label: 'Subject / Title', required: true },
  { key: 'contactName', label: 'Contact Name', required: false },
  { key: 'status', label: 'Status', required: true },
  { key: 'dateOpen', label: 'Date Opened (dd/mm/yyyy)', required: true },
  { key: 'caseOwner', label: 'Case Owner', required: false },
  { key: 'remedyTarget', label: 'Remedy / Resolution Target Date (dd/mm/yyyy)', required: true },
];

function guessColumn(role, columns) {
  const hints = {
    caseNumber: ['case number', 'case_number', 'caseid', 'case id', 'id'],
    subject: ['subject', 'title'],
    contactName: ['contact name', 'contact_name', 'customer', 'requester'],
    status: ['status'],
    dateOpen: ['date open', 'date_open', 'opened', 'created'],
    caseOwner: ['case owner', 'case_owner', 'owner', 'assigned'],
    remedyTarget: ['remedy target', 'remedy_target', 'resolution target', 'solution target'],
  };
  const candidates = hints[role] || [];
  const match = columns.find((c) =>
    candidates.some((h) => c.toLowerCase().replace(/[_\s]+/g, ' ').includes(h))
  );
  return match || '';
}

function ColumnMapper({ columns, onConfirm, onBack }) {
  const [mapping, setMapping] = useState(() => {
    const initial = {};
    ROLES.forEach((r) => {
      initial[r.key] = guessColumn(r.key, columns);
    });
    return initial;
  });

  const missingRequired = ROLES.filter((r) => r.required && !mapping[r.key]);

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition mb-4"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Map Your Columns</h2>
        <p className="text-sm text-gray-500 mb-6">
          Tell us which column in your file corresponds to each field. Dates must be in dd/mm/yyyy format. Priority is calculated automatically from the target date, so it's not mapped here.
        </p>

        <div className="space-y-4">
          {ROLES.map((role) => (
            <div key={role.key} className="flex items-center justify-between gap-4">
              <label className="text-sm font-medium text-gray-700 w-1/2">
                {role.label}
                {role.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <select
                className="w-1/2 border rounded-lg p-2 text-sm"
                value={mapping[role.key]}
                onChange={(e) => setMapping({ ...mapping, [role.key]: e.target.value })}
              >
                <option value="">— Not used —</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {missingRequired.length > 0 && (
          <p className="text-xs text-amber-600 mt-4">
            Heads up: {missingRequired.map((r) => r.label).join(', ')} not set — those widgets will be skipped or show as "Unknown".
          </p>
        )}

        <button
          onClick={() => onConfirm(mapping)}
          className="mt-6 w-full py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default ColumnMapper;