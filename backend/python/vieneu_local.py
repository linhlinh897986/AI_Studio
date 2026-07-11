import sys
import os
import argparse
import warnings

# Set Hugging Face cache directory
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
os.environ["HF_HOME"] = os.path.join(base_dir, ".venv", "hf_cache")

# Suppress warnings
warnings.filterwarnings("ignore")

def main():
    parser = argparse.ArgumentParser(description="VieNeu TTS Local Synthesizer")
    parser.add_argument('--text', required=True, help='Text to synthesize')
    parser.add_argument('--output', required=True, help='Output audio file path')
    parser.add_argument('--voice', help='Preset voice name')
    parser.add_argument('--ref_audio', help='Reference audio path for cloning')
    args = parser.parse_args()

    try:
        from vieneu import Vieneu
        
        # Initialize VieNeu model
        # Vieneu automatically utilizes GPU if onnxruntime-gpu is installed
        tts = Vieneu()
        
        # Determine voice or cloning mode
        if args.ref_audio and os.path.exists(args.ref_audio):
            print(f"Cloning voice from reference audio: {args.ref_audio}")
            audio = tts.infer(text=args.text, ref_audio=args.ref_audio)
        elif args.voice:
            print(f"Using preset voice: {args.voice}")
            audio = tts.infer(text=args.text, voice=args.voice)
        else:
            print("Using default voice (Trúc Ly)")
            audio = tts.infer(text=args.text)
            
        # Ensure output directory exists
        out_dir = os.path.dirname(args.output)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
            
        # Save output file
        tts.save(audio, args.output)
        print("SUCCESS")
    except Exception as e:
        import traceback
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
