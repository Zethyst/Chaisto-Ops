import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import BufferedTextInput from '../BufferedTextInput';

/**
 * Reproduces the typing bug: every keystroke goes out to redux and comes back
 * as a prop one keystroke behind, and a plainly controlled input rewrites the
 * native field from it — dropping the newest character and moving the caret.
 */
function mount(value: string, onChangeText = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<BufferedTextInput value={value} onChangeText={onChangeText} />); });
  const input = () => tree.root.findByType(TextInput);
  const rerender = (next: string) =>
    act(() => { tree.update(<BufferedTextInput value={next} onChangeText={onChangeText} />); });
  return { tree, input, rerender, onChangeText };
}

describe('while the field has focus', () => {
  it('keeps the typed text when a stale value arrives from the parent', () => {
    const { input, rerender } = mount('');

    act(() => input().props.onFocus({}));
    act(() => input().props.onChangeText('1'));
    act(() => input().props.onChangeText('12'));

    // The round trip finally delivers what the first keystroke produced
    rerender('1');

    expect(input().props.value).toBe('12');
  });

  it('passes every keystroke out as it is typed', () => {
    const { input, onChangeText } = mount('');

    act(() => input().props.onFocus({}));
    act(() => input().props.onChangeText('4'));
    act(() => input().props.onChangeText('42'));

    expect(onChangeText.mock.calls.map(([t]) => t)).toEqual(['4', '42']);
  });

  it('holds a partial entry the parent cannot represent', () => {
    const { input, rerender } = mount('');

    act(() => input().props.onFocus({}));
    act(() => input().props.onChangeText('1.'));
    // "1." parses to 1, so the parent sends back "1"
    rerender('1');

    expect(input().props.value).toBe('1.');
  });
});

describe('when the field is not being typed into', () => {
  it('takes a value changed from outside', () => {
    const { input, rerender } = mount('');

    rerender('250');

    expect(input().props.value).toBe('250');
  });

  it('shows the parent\'s normalised value once focus leaves', () => {
    const { input, rerender } = mount('');

    act(() => input().props.onFocus({}));
    act(() => input().props.onChangeText('007'));
    act(() => input().props.onBlur({}));
    rerender('7');

    expect(input().props.value).toBe('7');
  });

  it('leaves the text alone when the value has not actually changed', () => {
    const { input, rerender } = mount('50');

    rerender('50');

    expect(input().props.value).toBe('50');
  });
});

describe('caller handlers', () => {
  it('still calls the focus and blur handlers it was given', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BufferedTextInput value="" onChangeText={jest.fn()} onFocus={onFocus} onBlur={onBlur} />,
      );
    });
    const input = tree.root.findByType(TextInput);

    act(() => input.props.onFocus({}));
    act(() => input.props.onBlur({}));

    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });
});
