import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../hooks/useSettings';
import s from './Menu.module.css';

export const MIN_MENU_WIDTH = 200;
export const MAX_MENU_WIDTH = 640;
const KEYBOARD_STEP = 16;

const clampWidth = (width: number) =>
  Math.round(Math.min(MAX_MENU_WIDTH, Math.max(MIN_MENU_WIDTH, width)));

function applyWidth(width: number | undefined) {
  const root = document.documentElement.style;
  if (width) root.setProperty('--menu-width-user', `${width}px`);
  else root.removeProperty('--menu-width-user');
}

/** Drag handle on the sidebar's right edge; the width is kept in the settings. Double click resets. */
export const MenuResizer = () => {
  const { t } = useTranslation();
  const menuWidth = useSettingsStore((state) => state.menuWidth);
  const setSettings = useSettingsStore((state) => state.setSettings);

  useEffect(() => applyWidth(menuWidth), [menuWidth]);

  const currentWidth = () =>
    (document.getElementById('bull-board-sidebar')?.getBoundingClientRect().width ?? 260) | 0;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const aside = handle.parentElement;
    const startX = event.clientX;
    const startWidth = currentWidth();
    let width = startWidth;

    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('bb-menu-resizing');
    aside?.classList.add(s.resizing);

    const onMove = (move: PointerEvent) => {
      width = clampWidth(startWidth + move.clientX - startX);
      applyWidth(width);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('bb-menu-resizing');
      aside?.classList.remove(s.resizing);
      if (width !== startWidth) setSettings({ menuWidth: width });
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowRight' ? KEYBOARD_STEP : event.key === 'ArrowLeft' ? -KEYBOARD_STEP : 0;
    if (!delta) return;
    event.preventDefault();
    setSettings({ menuWidth: clampWidth(currentWidth() + delta) });
  };

  return (
    <div
      className={s.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={t('MENU.RESIZE')}
      aria-valuemin={MIN_MENU_WIDTH}
      aria-valuemax={MAX_MENU_WIDTH}
      aria-valuenow={menuWidth ?? currentWidth()}
      title={t('MENU.RESIZE')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => setSettings({ menuWidth: undefined })}
    />
  );
};
