import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

function UploadCard({ onFileSelect }) {
  const [fileName, setFileName] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file) => {
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dataset Upload</h2>
        <p className="text-gray-500 mb-6">Please upload your dataset to continue</p>

        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-xl p-8 cursor-pointer transition
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
        >
          <UploadCloud className="mx-auto mb-3 text-gray-400" size={32} />
          <p className="text-sm text-gray-500">
            {fileName ? fileName : 'Drag a CSV here or click to browse'}
          </p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </label>

        <button
          disabled={!fileName}
          onClick={() => onFileSelect(fileName)}
          className={`mt-6 w-full py-3 rounded-xl font-medium transition
            ${fileName
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          Use
        </button>
      </div>
    </div>
  );
}

export default UploadCard;