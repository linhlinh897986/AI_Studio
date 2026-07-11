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
    parser = argparse.ArgumentParser(description="OmniVoice TTS Local Synthesizer")
    parser.add_argument('--text', required=True, help='Text to synthesize')
    parser.add_argument('--output', required=True, help='Output audio file path')
    parser.add_argument('--ref_audio', required=True, help='Reference audio path for cloning')
    args = parser.parse_args()

    try:
        from omnivoice import OmniVoice
        import torch
        
        # Determine device
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        print(f"Loading OmniVoice on device: {device}...")
        model = OmniVoice.from_pretrained(
            "k2-fsa/OmniVoice", 
            device_map=device, 
            dtype=dtype
        )
        
        print(f"Cloning voice from: {args.ref_audio}")
        audio = model.generate(text=args.text, ref_audio=args.ref_audio)
        
        # Save generated audio
        model.save(audio, args.output)
        print("SUCCESS")
    except Exception as e:
        import traceback
        print(f"ERROR: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
