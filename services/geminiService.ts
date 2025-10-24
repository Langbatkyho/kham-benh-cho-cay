import { GoogleGenAI, Part } from "@google/genai";

const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

export async function identifyPlant(apiKey: string, imageParts: Part[]): Promise<string> {
    const ai = getAI(apiKey);
    const prompt = `Dựa vào (các) hình ảnh được cung cấp, hãy nhận dạng loại cây này. Chỉ trả về tên phổ biến nhất của cây bằng tiếng Việt. Nếu không chắc chắn, hãy trả lời là "Không xác định".`;
    
    const contents = { parts: [...imageParts, { text: prompt }] };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            temperature: 0.2,
            topP: 0.9,
            topK: 32,
        },
    });

    return response.text.trim();
}

export async function analyzePlantHealth(apiKey: string, imageParts: Part[], plantName: string): Promise<string> {
    const ai = getAI(apiKey);
    const prompt = `
Bạn là một chuyên gia về thực vật học và bệnh lý cây trồng. Phân tích (các) hình ảnh của một cây "${plantName}".

Dựa trên hình ảnh, hãy cung cấp một phân tích toàn diện bằng tiếng Việt, sử dụng định dạng Markdown. Bao gồm các mục sau:

### 1. Tình trạng sức khỏe (Health Status)
*   Đánh giá sức khỏe tổng thể. Tìm kiếm bất kỳ dấu hiệu bệnh, sâu hại, héo úa, đổi màu hoặc thiếu hụt dinh dưỡng trên lá, thân và rễ có thể nhìn thấy. Hãy mô tả thật cụ thể.

### 2. Giải pháp cải thiện (Improvement Solutions)
*   Dựa trên đánh giá sức khỏe, cung cấp các bước hành động cụ thể để giải quyết bất kỳ vấn đề nào được xác định. Nếu cây khỏe mạnh, hãy đề xuất các cách để duy trì tình trạng đó.

### 3. Hướng dẫn chăm sóc chung (General Care Guide)
*   Cung cấp hướng dẫn chăm sóc cơ bản cho cây "${plantName}", bao gồm các yếu tố chính như: Ánh sáng, Nước, Đất, Phân bón, và Độ ẩm.
`;

    const contents = { parts: [...imageParts, { text: prompt }] };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
            temperature: 0.4,
            topP: 0.9,
            topK: 32,
        },
    });

    return response.text;
}

export async function getGoalOrientedAdvice(apiKey: string, plantName: string, healthAnalysis: string, userGoal: string): Promise<string> {
    const ai = getAI(apiKey);
    const prompt = `
Bạn là một chuyên gia cây trồng. Dựa vào bối cảnh sau:
- **Loại cây:** ${plantName}
- **Phân tích sức khỏe trước đó:** ${healthAnalysis}
- **Mục tiêu của người dùng:** "${userGoal}"

Hãy cung cấp lời khuyên chuyên sâu, cụ thể và có thể hành động để giúp người dùng đạt được mục tiêu của họ. Tập trung vào các kỹ thuật hoặc điều chỉnh nâng cao ngoài phần chăm sóc cơ bản đã được đề cập. Trình bày câu trả lời của bạn bằng tiếng Việt, sử dụng định dạng Markdown. Đừng lặp lại các thông tin đã có trong phần phân tích sức khỏe trước đó.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.5,
            topP: 0.9,
            topK: 40,
        },
    });

    return response.text;
}
