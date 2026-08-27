import { useState } from 'react';
import { UploadCloud, FileSpreadsheet, FileText, X, CheckCircle2 } from 'lucide-react';

function UploadCard({ onFileSelect, theme = 'dark' }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const isDark = theme === 'dark';

  const handleFiles = (files) => {
    if (!files || files.length === 0) return;
    setSelectedFiles(Array.from(files));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleUse = () => {
    if (selectedFiles.length > 0) {
      onFileSelect(selectedFiles);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getExtension = (name) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };

  const getFileIcon = (name) => {
    const ext = getExtension(name);
    return ext === 'csv' ? FileText : FileSpreadsheet;
  };

  const formatSize = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`min-h-[calc(100vh-7rem)] flex items-center justify-center px-4 py-10 ${
        isDark ? 'bg-slate-900' : 'bg-slate-50'
      }`}
    >
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                isDark
                  ? 'bg-blue-950/60 text-blue-400'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              <UploadCloud size={22} />
            </div>

            <div>
              <h2
                className={`text-xl font-bold ${
                  isDark ? 'text-white' : 'text-slate-800'
                }`}
              >
                Upload Data
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Add one or more datasets to explore, analyze, and build models.
              </p>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div
          className={`rounded-2xl border shadow-sm p-5 ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
        >
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              // Prevent flickering while moving over children inside the label.
              if (e.currentTarget === e.target) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
            className={`group block rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
              isDragging
                ? isDark
                  ? 'border-blue-400 bg-blue-950/30'
                  : 'border-blue-500 bg-blue-50'
                : isDark
                  ? 'border-slate-600 bg-slate-900/40 hover:border-blue-500 hover:bg-slate-900/60'
                  : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/40'
            }`}
          >
            <div className="px-6 py-10 text-center">
              <div
                className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center transition ${
                  isDragging
                    ? 'bg-blue-600 text-white'
                    : isDark
                      ? 'bg-slate-700 text-blue-400 group-hover:bg-blue-950/60'
                      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100'
                }`}
              >
                <UploadCloud size={28} />
              </div>

              <h3
                className={`mt-4 text-sm font-semibold ${
                  isDark ? 'text-slate-100' : 'text-slate-800'
                }`}
              >
                {isDragging ? 'Drop your files here' : 'Drag & drop your datasets here'}
              </h3>

              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                or click anywhere in this area to browse from your computer
              </p>

              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 text-[11px] font-semibold">
                <span>.CSV</span>
                <span className="text-slate-400">·</span>
                <span>.XLSX</span>
                <span className="text-slate-400">·</span>
                <span>.XLS</span>
              </div>

              <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-600">
                Multiple files supported
              </p>
            </div>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`text-xs font-semibold ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}
                >
                  Selected datasets
                </div>

                <span className="text-[10px] font-medium text-slate-400">
                  {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-2">
                {selectedFiles.map((file, index) => {
                  const Icon = getFileIcon(file.name);

                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        isDark
                          ? 'border-slate-700 bg-slate-900/40'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDark
                            ? 'bg-slate-800 text-blue-400'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        <Icon size={15} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-medium truncate ${
                            isDark ? 'text-slate-200' : 'text-slate-700'
                          }`}
                        >
                          {file.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {getExtension(file.name).toUpperCase()} · {formatSize(file.size)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                          isDark
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-950/30'
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                className={`mt-4 flex items-center gap-2 text-[10px] ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                <CheckCircle2 size={13} />
                Ready to import
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 mt-6">
            <p className="text-[10px] leading-4 text-slate-400 dark:text-slate-600 max-w-sm">
              Your files are processed by the application and can be used for
              dashboard analysis, exploration, and machine-learning workflows.
            </p>

            <button
              type="button"
              disabled={selectedFiles.length === 0}
              onClick={handleUse}
              className={`flex items-center justify-center gap-2 min-w-[138px] px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                selectedFiles.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  : isDark
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <UploadCloud size={14} />
              Use Dataset{selectedFiles.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>

        {/* Small helper row */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400 dark:text-slate-600">
          <span>Supported formats: CSV, XLSX, XLS</span>
          <span>·</span>
          <span>Multiple uploads supported</span>
        </div>
      </div>
    </div>
  );
}

export default UploadCard;
