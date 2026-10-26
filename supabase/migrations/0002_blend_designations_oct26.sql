-- Project values found in the 26 Oct 2026 Cropster export that were not in the original seed.
insert into blend_designations (name, origin_code, site_code, note) values
  ('HACO (Freeze Dried)', 'BR', 'HAC', 'Cropster Project value seen 26 Oct 2026 — HACO freeze-dried instant'),
  ('Single Origin (Colombia)', 'CO', 'RST', 'Cropster Project value seen 26 Oct 2026'),
  ('Light Blend', 'GT', 'RST', 'Cropster Project value seen 26 Oct 2026 — Light blend (Guatemala / Kenya / Rwanda / China / Mexico Chikon)'),
  ('Xmas Blend 2026 - Guatemala', 'GT', 'RST', 'Seasonal — Primavera Christmas lot')
on conflict (name) do update set origin_code = excluded.origin_code, site_code = excluded.site_code, note = excluded.note;
