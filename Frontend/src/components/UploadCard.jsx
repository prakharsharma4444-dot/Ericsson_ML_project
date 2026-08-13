import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

function UploadCard({ onFileSelect }) {
  // Upgraded from a single string to an array of File objects
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files) => {
    if (files && files.length > 0) {
      // Convert the FileList object from the browser into a standard JavaScript array
      const fileArray = Array.from(files);
      setSelectedFiles(fileArray);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    // Grab all dropped files, not just the first one at index [0]
    handleFiles(e.dataTransfer.files);
  };

  const handleUse = () => {
    if (selectedFiles.length > 0) {
      // Pass the entire array of files back to App.jsx
      onFileSelect(selectedFiles);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dataset Upload</h2>
        <p className="text-gray-500 mb-6">Upload your datasets to continue</p>

        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-xl p-8 cursor-pointer transition
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
        >
          <UploadCloud className="mx-auto mb-3 text-gray-400" size={32} />
          <p className="text-sm text-gray-500">
            {selectedFiles.length > 0 
              ? `${selectedFiles.length} file(s) selected` 
              : 'Drag CSV or Excel files here, or click to browse'}
          </p>
          
          {/* Displays a small list of the file names once selected */}
          {selectedFiles.length > 0 && (
            <div className="mt-2 text-xs text-gray-400 break-words">
              {selectedFiles.map(f => f.name).join(', ')}
            </div>
          )}
          
          <input
            type="file"
            // The magic attributes: accepting Excel formats and allowing multiple files
            accept=".csv, .xlsx, .xls"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        <button
          disabled={selectedFiles.length === 0}
          onClick={handleUse}
          className={`mt-6 w-full py-3 rounded-xl font-medium transition
            ${selectedFiles.length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
        >
          Use Datasets
        </button>
      </div>
    </div>
  );
}

export default UploadCard;