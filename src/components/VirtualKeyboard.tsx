import { useState, useEffect } from 'react';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';

interface VirtualKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  onCancel: () => void;
}

export default function VirtualKeyboard({ value, onChange, onDone, onCancel }: VirtualKeyboardProps) {
  const [shifted, setShifted] = useState(true);

  // Auto-shift when value is empty or ends with a space
  useEffect(() => {
    if (value.length === 0 || value.endsWith(' ')) {
      setShifted(true);
    }
  }, [value]);

  function handleKeyPress(button: string) {
    if (button === '{bksp}') {
      onChange(value.slice(0, -1));
    } else if (button === '{space}') {
      onChange(value + ' ');
    } else if (button === '{shift}') {
      setShifted((s) => !s);
    } else {
      onChange(value + button);
      if (shifted) setShifted(false);
    }
  }

  const layoutName = shifted ? 'shift' : 'default';

  return (
    <div className="mt-3 xl:mt-5">
      <div className="chalk-keyboard">
        <Keyboard
          onKeyPress={handleKeyPress}
          layoutName={layoutName}
          layout={{
            default: [
              'q w e r t y u i o p',
              'a s d f g h j k l',
              '{shift} z x c v b n m {bksp}',
              '{space}',
            ],
            shift: [
              'Q W E R T Y U I O P',
              'A S D F G H J K L',
              '{shift} Z X C V B N M {bksp}',
              '{space}',
            ],
          }}
          display={{
            '{bksp}': '⌫',
            '{space}': 'Space',
            '{shift}': '⇧',
          }}
          buttonAttributes={shifted ? [{ attribute: 'data-active', value: 'true', buttons: '{shift}' }] : undefined}
          theme="hg-theme-default chalk-keyboard-theme"
        />
      </div>
      <div className="flex gap-3 xl:gap-5 mt-3 xl:mt-5">
        <button
          onClick={onDone}
          className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-win text-board-dark font-bold text-lg xl:text-2xl"
        >
          Done
        </button>
        <button
          onClick={onCancel}
          className="btn-press flex-1 min-h-[64px] xl:min-h-[96px] rounded-lg bg-board-light text-chalk-dim font-bold text-lg xl:text-2xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
