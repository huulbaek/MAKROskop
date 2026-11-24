"""The MAKRO reference stamped into the published data (extract.model_version, makroskop-big).

The commit must identify the model files the data is read from. Stamping the checkout's HEAD
relabelled every published file whenever DREAM committed something else (new shock files, a new
databank), although the model had not changed.
"""

import os
import subprocess
import zipfile
from pathlib import Path

import pytest

import extract


def git(repo: Path, *args: str, env: dict[str, str] | None = None) -> str:
    quiet = ["-c", "user.name=test", "-c", "user.email=test@example.invalid",
             "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"]
    # nothing inherited: a GIT_DIR from a hook would aim these commits at the real repository, and a
    # global ignore or template could change what gets committed
    clean = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    clean.update({"GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"})
    return subprocess.run(["git", "-C", str(repo), *quiet, *args], check=True, capture_output=True, text=True,
                          env={**clean, **(env or {})}).stdout.strip()


def commit(repo: Path, path: str, content: bytes, date: str, authored: str | None = None) -> str:
    """Commit one file on `date` (the committer date; `authored` if the change was written earlier)."""
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    git(repo, "add", path)
    git(repo, "commit", "-q", "-m", f"change {path}",
        env={"GIT_AUTHOR_DATE": f"{authored or date}T12:00:00+0000", "GIT_COMMITTER_DATE": f"{date}T12:00:00+0000"})
    return git(repo, "rev-parse", "--short", "HEAD")


@pytest.fixture
def clone(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    """A MAKRO-like checkout: the calibration zip, then the baseline, then commits that touch neither."""
    repo = tmp_path / "MAKRO"
    repo.mkdir()
    git(repo, "init", "-q")
    archive = tmp_path / "dump.zip"
    with zipfile.ZipFile(archive, "w") as handle:  # the dump finished on 7 Sept, a week before it was committed
        handle.writestr(zipfile.ZipInfo("raw.gms", date_time=(2026, 9, 6, 23, 48, 0)), "E_a[t].. a[t] =E= 1;")
        handle.writestr(zipfile.ZipInfo("gams.gms", date_time=(2026, 9, 7, 0, 48, 0)), "e1.. x1 =E= 1;")
    commits = {"zip": commit(repo, "Model/deep_dynamic_calibration.zip", archive.read_bytes(), "2026-09-14",
                             authored="2026-09-10")}
    (repo / "README.md").write_text("# MAKRO 2026-Test\n", encoding="utf-8")
    git(repo, "add", "README.md")
    commits["baseline"] = commit(repo, "Model/Gdx/baseline.gdx", b"baseline", "2026-09-24")
    commits["shocks"] = commit(repo, "Analysis/Standard_shocks/Gdx/Rente_ufin.gdx", b"shock file", "2026-10-09")
    commits["databank"] = commit(repo, "Model/Gdx/static_calibration_nominal.gdx", b"databank", "2026-11-19")
    return repo, commits


def test_the_model_commit_is_where_the_model_files_last_changed_not_head(clone) -> None:
    repo, commits = clone
    version = extract.model_version(repo)
    assert version["commit"] == commits["baseline"]
    assert version["commit"] != commits["databank"]  # HEAD: two commits later, same model files
    assert version["name"] == "MAKRO 2026-Test"


def test_a_change_to_the_calibration_zip_moves_the_model_commit(clone) -> None:
    repo, _commits = clone
    newer = commit(repo, "Model/deep_dynamic_calibration.zip", b"a new dump", "2026-10-29")
    assert extract.input_commit(repo, extract.MODEL_INPUTS) == newer


def test_input_commit_follows_the_paths_asked_for(clone) -> None:
    repo, commits = clone
    assert extract.input_commit(repo, ["Model/deep_dynamic_calibration.zip"]) == commits["zip"]
    assert extract.input_commit(repo, ["Analysis/Standard_shocks/Gdx", "Model/Gdx/baseline.gdx"]) == commits["shocks"]


def test_paths_git_has_never_seen_fall_back_to_head(clone) -> None:
    repo, commits = clone
    assert extract.input_commit(repo, ["Model/not_in_the_repo.gdx"]) == commits["databank"]


def test_dreams_shock_files_are_labelled_by_where_they_last_changed(clone) -> None:
    # Validering cites the commit DREAM's files were read from next to their SHA-256 sums; the model
    # files' commit (older) would point at a state where those files were different or absent
    import dream_comparison as dc

    repo, commits = clone
    assert dc.dream_files_version(repo)["commit"] == commits["shocks"]


def test_a_directory_that_is_not_a_git_checkout_gets_no_commit(tmp_path: Path) -> None:
    assert extract.input_commit(tmp_path, extract.MODEL_INPUTS) == ""


def test_a_model_file_edited_since_its_commit_cannot_be_labelled_with_it(clone) -> None:
    # the fingerprint is read from the working tree, the commit from history: they must be the same file
    repo, _commits = clone
    (repo / "Model/Gdx/baseline.gdx").write_bytes(b"replaced by hand")
    with pytest.raises(SystemExit, match="differ from commit"):
        extract.model_version(repo)


def test_the_model_name_is_read_at_the_model_commit(clone) -> None:
    # DREAM can rename the version in the README before new model files follow; the data is still the old model's
    repo, _commits = clone
    commit(repo, "README.md", b"# MAKRO 2027-Next\n", "2026-12-01")
    assert extract.model_version(repo)["name"] == "MAKRO 2026-Test"


def test_the_zip_dump_date_is_its_newest_member_timestamp(clone) -> None:
    repo, _commits = clone
    assert extract.zip_dump_date(repo) == "2026-09-07"


def test_input_date_is_the_date_of_the_commit_that_last_changed_the_file(clone) -> None:
    repo, _commits = clone
    assert extract.input_date(repo, ["Model/deep_dynamic_calibration.zip"]) == "2026-09-14"
    assert extract.input_date(repo, ["Model/Gdx/baseline.gdx"]) == "2026-09-24"
    assert extract.input_date(repo, ["Model/not_in_the_repo.gdx"]) == ""


def test_the_reference_files_note_is_built_from_the_checkout(clone) -> None:
    # Validering explains the level gap between the two reference points with when each file entered
    # DREAM's repository; the dates and commits must come from the checkout, not from the page
    import dream_comparison as dc

    repo, commits = clone
    assert dc.reference_files_note(**dc.reference_file_facts(repo)) == (
        "De to filer er lagt i MAKRO-repositoriet hver for sig: zip-filen er dannet 7. september 2026 og lagt ud "
        f"14. september 2026 (commit {commits['zip']}), grundforløbet 24. september 2026 (commit {commits['baseline']}).")


def test_the_note_is_withheld_when_the_checkout_holds_another_zip_than_the_scenarios_were_solved_on(clone) -> None:
    # after a pull the clone's zip can be a newer dump; its dates would then describe the wrong file
    import dream_comparison as dc

    repo, _commits = clone
    solved_on = extract.model_fingerprint(repo)
    assert dc.checkout_reference_note(repo, solved_on).startswith("De to filer er lagt i MAKRO-repositoriet hver for sig")
    assert dc.checkout_reference_note(repo, "0123456789ab") is None
    assert dc.checkout_reference_note(repo, "") is None
