import React, { useEffect, useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
};

/**
 * A TextInput that owns its text while it is being typed into.
 *
 * A plainly controlled input sends every keystroke on a round trip — into redux
 * or a parent, through a parse, and back down as a prop. On Android the native
 * field is rewritten from whatever comes back, and when someone types faster
 * than that round trip completes, the value arriving is a keystroke behind:
 * the letter just typed is re-appended at the end and the caret lands one
 * place short of it.
 *
 * So while the field has focus its text is local and nothing overwrites it. The
 * outside value is taken back the moment focus leaves — which is also when a
 * value the parent normalised (rounding, unit conversion) should be shown.
 */
export default function BufferedTextInput({ value, onChangeText, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);

  // `text` is deliberately not a dependency: this reacts to the value changing
  // underneath the field, not to the field's own typing.
  useEffect(() => {
    if (!focused && value !== text) setText(value);
  }, [value, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TextInput
      {...rest}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChangeText(next);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}
