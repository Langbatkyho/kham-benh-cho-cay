import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { identifyPlant, analyzePlantHealth, getGoalOrientedAdvice } from './services/geminiService';
import { fileToGenerativePart } from './utils/fileUtils';
import { UploadIcon, PlantIcon, SparklesIcon, BackIcon, CheckIcon } from './components/icons';
import Spinner from './components/Spinner';
import MarkdownRenderer from './components/MarkdownRenderer';
import { Part } from '@google/genai';

type Step = 'API_KEY' | 'UPLOAD' | 'CONFIRM' | 'DIAGNOSE' | 'GOAL';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const useApiKey = () => {
    const [apiKey, setApiKey] = useState<string | null>(null);

    useEffect(() => {
        try {
            const item = window.sessionStorage.getItem('gemini-api-key');
            if (item) {
                const { key, timestamp } = JSON.parse(item);
                if (Date.now() - timestamp < SESSION_TIMEOUT_MS) {
                    setApiKey(key);
                } else {
                    window.sessionStorage.removeItem('gemini-api-key');
                }
            }
        } catch (error) {
            console.error("Failed to read API key from session storage", error);
            window.sessionStorage.removeItem('gemini-api-key');
        }
    }, []);

    const saveApiKey = (key: string) => {
        if (key) {
            const item = {
                key,
                timestamp: Date.now(),
            };
            window.sessionStorage.setItem('gemini-api-key', JSON.stringify(item));
            setApiKey(key);
        }
    };

    return { apiKey, saveApiKey };
};


const App: React.FC = () => {
  const { apiKey, saveApiKey } = useApiKey();
  const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
  
  // Global state for the workflow
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null]);
  const [imageDataUrls, setImageDataUrls] = useState<(string | null)[]>([null, null]);
  const [plantName, setPlantName] = useState('');
  const [healthAnalysis, setHealthAnalysis] = useState('');
  const [goalAnalysis, setGoalAnalysis] = useState('');
  const [userGoal, setUserGoal] = useState('');
  
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setCurrentStep('API_KEY');
    } else {
      setCurrentStep('UPLOAD');
    }
  }, [apiKey]);
  
  const resetWorkflow = () => {
      setImageFiles([null, null]);
      setImageDataUrls([null, null]);
      setPlantName('');
      setHealthAnalysis('');
      setGoalAnalysis('');
      setUserGoal('');
      setLoadingMessage(null);
      setError(null);
      setCurrentStep('UPLOAD');
  };

  const handleImageChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Vui lòng chỉ chọn tệp hình ảnh.');
        return;
      }
      const newImageFiles = [...imageFiles];
      newImageFiles[index] = file;
      setImageFiles(newImageFiles);

      const reader = new FileReader();
      reader.onloadend = () => {
        const newImageDataUrls = [...imageDataUrls];
        newImageDataUrls[index] = reader.result as string;
        setImageDataUrls(newImageDataUrls);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIdentification = async () => {
      if (!imageFiles.some(f => f)) {
          setError("Vui lòng tải lên ít nhất một hình ảnh.");
          return;
      }
      setLoadingMessage('Đang nhận dạng cây của bạn...');
      setError(null);
      try {
          const imageParts: Part[] = await Promise.all(
              imageFiles
                  .filter((file): file is File => file !== null)
                  .map(file => fileToGenerativePart(file))
          );
          const name = await identifyPlant(apiKey!, imageParts);
          setPlantName(name);
          setCurrentStep('CONFIRM');
      } catch (e) {
          console.error(e);
          setError('Không thể nhận dạng cây. Vui lòng thử lại với hình ảnh khác.');
      } finally {
          setLoadingMessage(null);
      }
  };
  
    const handleAnalysis = async () => {
        if (!plantName.trim()) {
            setError('Tên cây không được để trống.');
            return;
        }
        setLoadingMessage('AI đang phân tích sức khỏe cây trồng...');
        setError(null);
        try {
            const imageParts: Part[] = await Promise.all(
                imageFiles
                    .filter((file): file is File => file !== null)
                    .map(file => fileToGenerativePart(file))
            );
            const result = await analyzePlantHealth(apiKey!, imageParts, plantName);
            setHealthAnalysis(result);
            setCurrentStep('DIAGNOSE');
        } catch (e) {
            console.error(e);
            setError('Phân tích không thành công. Vui lòng thử lại.');
        } finally {
            setLoadingMessage(null);
        }
    };

    const handleGoalAdvice = async () => {
        if (!userGoal.trim()) {
            setError('Vui lòng nhập mục tiêu chăm sóc.');
            return;
        }
        setLoadingMessage('Đang tạo lời khuyên chuyên sâu...');
        setError(null);
        try {
            const result = await getGoalOrientedAdvice(apiKey!, plantName, healthAnalysis, userGoal);
            setGoalAnalysis(result);
        } catch (e) {
            console.error(e);
            setError('Không thể tạo lời khuyên. Vui lòng thử lại.');
        } finally {
            setLoadingMessage(null);
        }
    };


    const renderContent = () => {
        if (loadingMessage) {
            return <LoadingView message={loadingMessage} />;
        }
        if (error) {
            return <ErrorView message={error} onReset={() => { setError(null); setCurrentStep('UPLOAD'); }} />;
        }
        switch (currentStep) {
            case 'API_KEY':
                return <ApiKeyInput onKeySubmit={saveApiKey} />;
            case 'UPLOAD':
                return <UploadStep onImageChange={handleImageChange} imageDataUrls={imageDataUrls} onNext={handleIdentification} />;
            case 'CONFIRM':
                return <ConfirmStep imageDataUrls={imageDataUrls} plantName={plantName} setPlantName={setPlantName} onNext={handleAnalysis} />;
            case 'DIAGNOSE':
                return <DiagnoseStep result={healthAnalysis} onNext={() => setCurrentStep('GOAL')} />;
            case 'GOAL':
                return <GoalStep userGoal={userGoal} setUserGoal={setUserGoal} onAnalyzeGoal={handleGoalAdvice} result={goalAnalysis} onReset={resetWorkflow} />;
            default:
                return <ApiKeyInput onKeySubmit={saveApiKey} />;
        }
    };
    
    const stepOrder: Step[] = ['UPLOAD', 'CONFIRM', 'DIAGNOSE', 'GOAL'];
    const currentStepIndex = stepOrder.indexOf(currentStep);

    if (currentStep === 'API_KEY') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-green-50 text-gray-800">
                {renderContent()}
            </div>
        );
    }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-green-800 flex items-center justify-center gap-3">
            <PlantIcon className="w-10 h-10" />
            Chuyên gia Cây trồng AI
          </h1>
          <p className="text-green-600 mt-2 text-lg">Trợ lý ảo chăm sóc khu vườn của bạn</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <VerticalStepper currentStepIndex={currentStepIndex} />
            <main className="md:col-span-3 bg-white rounded-2xl shadow-xl p-4 md:p-8 transition-all duration-500 ease-in-out min-h-[600px] flex flex-col justify-center">
                {renderContent()}
            </main>
        </div>
        <footer className="text-center mt-6 text-sm text-gray-500">
          <p>Phát triển với Gemini API</p>
        </footer>
      </div>
    </div>
  );
};

// --- Step Components ---

const ApiKeyInput: React.FC<{ onKeySubmit: (key: string) => void }> = ({ onKeySubmit }) => {
    const [key, setKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (key.trim()) {
            onKeySubmit(key.trim());
        }
    };
    
    return (
        <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
             <h2 className="text-2xl font-bold text-green-800 text-center">Chào mừng bạn!</h2>
             <p className="text-center text-gray-600 mt-2 mb-6">Vui lòng nhập Gemini API Key của bạn để bắt đầu.</p>
             <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Nhập API Key của bạn"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 placeholder:text-gray-400"
                    aria-label="Gemini API Key"
                />
                <button
                    type="submit"
                    className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    Bắt đầu
                </button>
             </form>
             <p className="text-xs text-center text-gray-400 mt-4">
                Khóa của bạn chỉ được lưu trong phiên này và sẽ bị xóa sau 30 phút không hoạt động.
             </p>
        </div>
    );
};

const STEPS = [
    { name: "Tải ảnh", description: "Cung cấp hình ảnh cây trồng" },
    { name: "Xác nhận", description: "Xác nhận tên loại cây" },
    { name: "Chẩn đoán", description: "Phân tích sức khỏe cây" },
    { name: "Tư vấn", description: "Nhận lời khuyên chuyên sâu" },
];

const VerticalStepper: React.FC<{ currentStepIndex: number }> = ({ currentStepIndex }) => {
    return (
        <nav aria-label="Progress">
            <ol role="list" className="space-y-4 md:space-y-6 bg-white p-6 rounded-2xl shadow-xl">
                {STEPS.map((step, index) => (
                    <li key={step.name}>
                        {index < currentStepIndex ? (
                            // Completed Step
                            <div className="group flex items-center w-full">
                                <span className="flex items-center px-4 py-2 text-sm font-medium">
                                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-600">
                                        <CheckIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                    </span>
                                    <span className="ml-4 text-sm font-medium text-gray-900">{step.name}</span>
                                </span>
                            </div>
                        ) : index === currentStepIndex ? (
                            // Current Step
                            <div className="flex items-center" aria-current="step">
                                <span className="flex items-center px-4 py-2 text-sm font-medium">
                                     <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-green-600">
                                        <span className="text-green-600">{`0${index + 1}`}</span>
                                    </span>
                                    <span className="ml-4 text-sm font-medium text-green-600">{step.name}</span>
                                </span>
                            </div>
                        ) : (
                             // Upcoming Step
                             <div className="group flex items-center w-full">
                                <span className="flex items-center px-4 py-2 text-sm font-medium">
                                     <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300">
                                        <span className="text-gray-500">{`0${index + 1}`}</span>
                                    </span>
                                    <span className="ml-4 text-sm font-medium text-gray-500">{step.name}</span>
                                </span>
                            </div>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};


const ImageUploader: React.FC<{ id: string; label: string; description: string; onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void; imageDataUrl: string | null; }> = ({ id, label, description, onImageChange, imageDataUrl }) => (
  <div className="text-center w-full">
    {imageDataUrl ? (
        <div className="relative group">
            <img src={imageDataUrl} alt={label} className="w-full h-48 object-cover rounded-xl shadow-md"/>
            <label htmlFor={id} className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                Đổi ảnh
            </label>
        </div>
    ) : (
        <label
            htmlFor={id}
            className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-green-200 rounded-xl p-6 hover:border-green-400 hover:bg-green-50 transition-colors duration-300 h-48"
        >
            <UploadIcon className="w-10 h-10 text-green-500 mb-2" />
            <span className="font-semibold text-green-700">{label}</span>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
        </label>
    )}
    <input id={id} name={id} type="file" className="sr-only" accept="image/*,capture=camera" onChange={onImageChange} />
  </div>
);

const UploadStep: React.FC<{onImageChange: (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => void; imageDataUrls: (string|null)[]; onNext: () => void;}> = ({onImageChange, imageDataUrls, onNext}) => (
    <div className="flex flex-col items-center justify-center h-full gap-6">
        <h2 className="text-2xl font-bold text-green-800">Bước 1: Tải lên hình ảnh</h2>
        <p className="text-gray-600 text-center mb-4">Cung cấp tối đa 2 hình ảnh để AI có thể chẩn đoán chính xác nhất.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <ImageUploader id="file-upload-1" label="Ảnh tổng thể" description="Chụp toàn bộ cây" onImageChange={onImageChange(0)} imageDataUrl={imageDataUrls[0]} />
            <ImageUploader id="file-upload-2" label="Ảnh cận cảnh" description="Chụp lá, thân, rễ bị bệnh" onImageChange={onImageChange(1)} imageDataUrl={imageDataUrls[1]} />
        </div>
        <button
            onClick={onNext}
            className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
        >
            Tiếp theo
        </button>
    </div>
);


const ConfirmStep: React.FC<{imageDataUrls: (string|null)[], plantName: string; setPlantName: (name: string) => void; onNext: () => void}> = ({imageDataUrls, plantName, setPlantName, onNext}) => (
    <div className="flex flex-col items-center justify-center h-full gap-6">
        <h2 className="text-2xl font-bold text-green-800">Bước 2: Xác nhận loại cây</h2>
        <div className="flex gap-4 my-4">
            {imageDataUrls.map((url, index) => url && <img key={index} src={url} alt={`Plant image ${index+1}`} className="w-32 h-32 object-cover rounded-xl shadow-lg" />)}
        </div>
        <div className="w-full max-w-md">
            <label htmlFor="plant-name" className="block text-sm font-medium text-gray-700 mb-1">Tên cây (AI đề xuất)</label>
            <input
                type="text"
                id="plant-name"
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Bạn có thể chỉnh sửa nếu tên này không đúng.</p>
        </div>
        <button
            onClick={onNext}
            className="w-full max-w-md bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105 flex items-center justify-center gap-2"
        >
            <SparklesIcon className="w-5 h-5" />
            Chẩn đoán sức khỏe
        </button>
    </div>
);


const DiagnoseStep: React.FC<{ result: string; onNext: () => void }> = ({ result, onNext }) => (
    <div className="animate-fade-in w-full">
        <h2 className="text-3xl font-bold text-green-800 mb-4">Bước 3: Kết quả Chẩn đoán</h2>
        <div className="p-4 bg-green-50 rounded-lg max-h-[400px] overflow-y-auto prose prose-green max-w-none mb-6">
            <MarkdownRenderer content={result} />
        </div>
        <button
            onClick={onNext}
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
            Tư vấn chăm sóc theo mục tiêu
        </button>
    </div>
);


const GoalStep: React.FC<{userGoal: string; setUserGoal: (goal: string) => void; onAnalyzeGoal: () => void; result: string; onReset: () => void}> = ({userGoal, setUserGoal, onAnalyzeGoal, result, onReset}) => (
    <div className="animate-fade-in w-full flex flex-col h-full">
        <h2 className="text-3xl font-bold text-green-800 mb-4">Bước 4: Tư vấn chuyên sâu</h2>
        <div className="flex-grow">
            <label htmlFor="user-goal" className="block text-sm font-medium text-gray-700 mb-1">Mục tiêu chăm sóc của bạn là gì?</label>
            <textarea
                id="user-goal"
                rows={3}
                value={userGoal}
                onChange={(e) => setUserGoal(e.target.value)}
                placeholder="Ví dụ: làm cho cây ra hoa nhiều hơn, giúp lá xanh tốt hơn, trị rệp sáp..."
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 placeholder:text-gray-400"
            ></textarea>
            <button
                onClick={onAnalyzeGoal}
                className="w-full my-4 bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center justify-center gap-2"
            >
                <SparklesIcon className="w-5 h-5" />
                Nhận lời khuyên
            </button>
            {result && (
                <div className="p-4 bg-green-50 rounded-lg max-h-[250px] overflow-y-auto prose prose-green max-w-none">
                    <MarkdownRenderer content={result} />
                </div>
            )}
        </div>
         <button
            onClick={onReset}
            className="mt-auto bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2 self-start"
        >
            <BackIcon className="w-5 h-5" />
            Bắt đầu lại
        </button>
    </div>
);

const LoadingView: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center h-full">
    <Spinner />
    <p className="text-xl text-green-600 mt-6 font-medium">{message}</p>
  </div>
);

const ErrorView: React.FC<{ message: string; onReset: () => void }> = ({ message, onReset }) => (
  <div className="flex flex-col items-center justify-center text-center h-full text-red-600">
    <h2 className="text-2xl font-bold">Đã xảy ra lỗi</h2>
    <p className="mt-2">{message}</p>
    <button
      onClick={onReset}
      className="mt-6 bg-red-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-600 transition-colors"
    >
      Thử lại
    </button>
  </div>
);

export default App;