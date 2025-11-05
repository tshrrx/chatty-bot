import os
import json
import google.generativeai as genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.responses import StreamingResponse

load_dotenv()
try:
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    genai.configure(api_key=gemini_api_key)
except Exception as e:
    print(f"Warning: GEMINI_API_KEY not set. API calls will likely fail. Error: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = genai.GenerativeModel('gemini-2.5-flash')

class ChatRequest(BaseModel):
    """The simplified request body structure for a basic, non-contextual chat."""
    newMessage: str

def stream_gemini_response(new_message: str):
    """
    Calls the Gemini API using streaming and yields the chunks as SSE messages.
    """
    try:
        response_stream = model.generate_content(new_message, stream=True)
        for chunk in response_stream:
            if chunk.text:
                yield f"data: {json.dumps({'text': chunk.text})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        print(f"Error during streaming: {e}")
        yield f"data: {json.dumps({'error': 'Backend streaming error: ' + str(e)})}\n\n"

@app.post("/api/chat")
async def handle_chat_stream(request: ChatRequest):
    """
    Handles a chat request using streaming responses (SSE).
    """
    return StreamingResponse(
        stream_gemini_response(request.newMessage),
        media_type="text/event-stream"
    )

@app.get("/")
def read_root():
    return {"status": "FastAPI is running", "model": "gemini-2.5-flash"}