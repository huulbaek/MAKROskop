"""The solver's shock stamp (makroskop_meta) against the catalog (makroskop-gnp.1)."""

import catalog

LAST = 2129


def stamp(**overrides: str) -> dict[str, str]:
    """Bundskat_ufin as freesolver stamps it (fingerprint and dates left out)."""
    base = {
        "shock": "tBund", "shock_years": "2030-2129", "factor": "1.0", "delta": "0.01",
        "profile": "permanent", "endogenized": "", "closure": "none", "from_year": "2030",
        "exported": "2026-09-05", "share": "1.0",
    }
    return {**base, **overrides}


def test_expected_stamp_follows_the_catalog_run_and_variation() -> None:
    assert catalog.expected_stamp("Bundskat", "_ufin", LAST) == {
        "shock": "tBund", "shock_years": "2030-2129", "factor": 1.0, "delta": 0.01,
        "profile": "permanent", "endogenized": "", "closure": "none", "from_year": 2030, "share": 1.0,
    }
    assert catalog.expected_stamp("Bundskat", "_perm", LAST)["closure"] == "tax-reaction"
    assert catalog.expected_stamp("Bundskat", "_midl", LAST)["profile"] == "ar"


def test_expected_stamp_uses_the_solver_call_where_the_label_differs() -> None:
    assert catalog.expected_stamp("Udenlandske_priser", "_ufin", LAST)["shock"] == "pM,pXUdl"
    swap = catalog.expected_stamp("Arbejdsudbud_beskaeftigelse", "_ufin", LAST)
    assert (swap["shock"], swap["endogenized"]) == ("snLHh", "uDeltag")


def test_expected_stamp_is_none_for_an_uncatalogued_run() -> None:
    assert catalog.expected_stamp("Nonexistent", "_ufin", LAST) is None
    assert catalog.expected_stamp("Bundskat", "_xyz", LAST) is None


def test_a_matching_stamp_has_no_mismatches() -> None:
    assert catalog.stamp_mismatches("Bundskat", "_ufin", stamp(), LAST) == []


def test_numbers_compare_by_value_not_by_text() -> None:
    # run scripts pass 1/1.01 as a 14-digit literal
    timer = stamp(shock="uh", factor="0.99009900990099", delta="0.0")
    assert catalog.stamp_mismatches("Arbejdsudbud_timer", "_ufin", timer, LAST) == []


def test_a_catalog_size_the_solve_did_not_use_is_reported() -> None:
    # the makroskop-gnp.2 case: VAT solved with a flat delta, catalog says x0.98
    flat = stamp(shock="tMoms_y,tMoms_m", factor="1.0", delta="-0.005")
    assert catalog.stamp_mismatches("Moms_ned", "_ufin", flat, LAST) == [
        "factor: solved 1.0, catalog 0.98",
        "delta: solved -0.005, catalog 0.0",
    ]


def test_closure_shock_year_and_partial_stage_are_reported() -> None:
    assert catalog.stamp_mismatches("Bundskat", "_perm", stamp(), LAST) == [
        "closure: solved none, catalog tax-reaction",
    ]
    assert catalog.stamp_mismatches("Bundskat", "_ufin", stamp(from_year="2029", shock_years="2029-2129"), LAST) == [
        "shock_years: solved 2029-2129, catalog 2030-2129",
        "from_year: solved 2029, catalog 2030",
    ]
    assert catalog.stamp_mismatches("Bundskat", "_ufin", stamp(share="0.5"), LAST) == [
        "share: solved 0.5, catalog 1.0",
    ]


def test_a_missing_stamp_field_is_reported() -> None:
    partial = stamp()
    del partial["closure"]
    assert catalog.stamp_mismatches("Bundskat", "_ufin", partial, LAST) == [
        "closure: solved (missing), catalog none",
    ]
