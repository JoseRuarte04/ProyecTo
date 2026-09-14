"""Genera la migración de carga del catálogo global de ejercicios HEP2go.

Lee docs/data/HEP2go_catalogo_completo.xlsx (pestaña "Catalogo HEP2go ES")
y escribe supabase/migrations/20260823120000_exercise_library_catalog_seed.sql
con INSERTs batcheados (professional_id NULL = fila de catálogo global).

Uso: python3 scripts/generate_catalog_seed.py
Requiere: pip install openpyxl

Si HEP2go publica una versión actualizada de la planilla, correr este script
de nuevo regenera la migración con el mismo nombre de archivo — el
ON CONFLICT (source_exercise_id) hace que reaplicarla actualice las filas
existentes en vez de duplicarlas.
"""
import os
import openpyxl

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO_ROOT, "docs", "data", "HEP2go_catalogo_completo.xlsx")
OUT = os.path.join(REPO_ROOT, "supabase", "migrations", "20260823120000_exercise_library_catalog_seed.sql")

TYPE_SLUGS = {
    "Activo": "activo",
    "Activo asistido": "activo_asistido",
    "Fortalecimiento": "fortalecimiento",
    "Pasivo": "pasivo",
    "Sin clasificar": "sin_clasificar",
}


def sql_str(v):
    if v is None:
        return "NULL"
    s = str(v).strip()
    if not s:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def map_classification(raw):
    if not raw:
        return None
    tokens = [t.strip() for t in str(raw).split(";") if t.strip()]
    slugs = [TYPE_SLUGS[t] for t in tokens]
    return "; ".join(slugs)


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb["Catalogo HEP2go ES"]
    rows = ws.iter_rows(values_only=True)
    next(rows)  # header

    records = []
    seen_ids = set()
    for r in rows:
        if all(c is None for c in r):
            continue
        reg, sub, id_, _blank, name, instr, _img, _link, clasif, _crit = r
        assert id_ is not None and name, f"missing id/name: {r!r}"
        if id_ in seen_ids:
            continue  # defensive, dataset already verified unique
        seen_ids.add(id_)
        records.append({
            "name": str(name).strip(),
            "exercise_type": map_classification(clasif),
            "catalog_region": str(reg).strip() if reg else None,
            "catalog_subcategory": str(sub).strip() if sub else None,
            "instructions": str(instr).strip() if instr else None,
            "source_exercise_id": int(id_),
        })

    print(f"Total records: {len(records)}")

    batch_size = 500
    lines = [
        "-- Carga del catálogo global HEP2go (2928 ejercicios) en exercise_library.",
        "-- Generado automáticamente desde docs/data/HEP2go_catalogo_completo.xlsx",
        "-- (pestaña 'Catalogo HEP2go ES') por scripts/generate_catalog_seed.py — no editar a mano.",
        "-- professional_id NULL = fila de catálogo global (ver 20260823100000).",
        "-- ON CONFLICT sobre source_exercise_id permite reimportar de forma segura",
        "-- si la planilla de origen se actualiza más adelante.",
        "",
    ]

    cols = "(name, professional_id, is_active, exercise_type, catalog_region, catalog_subcategory, instructions, source_exercise_id)"
    conflict = (
        "ON CONFLICT (source_exercise_id) DO UPDATE SET\n"
        "  name = EXCLUDED.name,\n"
        "  exercise_type = EXCLUDED.exercise_type,\n"
        "  catalog_region = EXCLUDED.catalog_region,\n"
        "  catalog_subcategory = EXCLUDED.catalog_subcategory,\n"
        "  instructions = EXCLUDED.instructions,\n"
        "  updated_at = now();"
    )

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        lines.append(f"INSERT INTO exercise_library {cols}\nVALUES")
        value_lines = []
        for rec in batch:
            value_lines.append(
                "  (" + ", ".join([
                    sql_str(rec["name"]),
                    "NULL",
                    "true",
                    sql_str(rec["exercise_type"]),
                    sql_str(rec["catalog_region"]),
                    sql_str(rec["catalog_subcategory"]),
                    sql_str(rec["instructions"]),
                    str(rec["source_exercise_id"]),
                ]) + ")"
            )
        lines.append(",\n".join(value_lines))
        lines.append(conflict)
        lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Written {OUT}")


if __name__ == "__main__":
    main()
