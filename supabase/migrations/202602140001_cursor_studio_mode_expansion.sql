alter table public.profiles
  drop constraint if exists profiles_cursor_mode_check;

alter table public.profiles
  add constraint profiles_cursor_mode_check
  check (
    cursor_mode in (
      'glow',
      'crosshair',
      'morph',
      'split',
      'hollow_square',
      'target_lock',
      'invert',
      'elastic',
      'outline_morph',
      'shadow_echo'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_cursor_trail_mode_check;

alter table public.profiles
  add constraint profiles_cursor_trail_mode_check
  check (
    cursor_trail_mode in (
      'velocity',
      'dots',
      'pixel',
      'motion_blur',
      'neon_thread',
      'smoke',
      'gravity',
      'ripple_wake',
      'data_stream',
      'dual_layer',
      'pulse_droplets'
    )
  );
