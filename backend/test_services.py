from services import parse_transcript, timestamp_to_seconds


def test_transcript_parser_handles_pasted_timestamped_lines():
    segments = parse_transcript("[01:02] Maya: Decision made\nAlex: Follow up", ".txt")
    assert [(item["speaker"], item["start_seconds"]) for item in segments] == [("Maya", 62), ("Alex", 30)]


def test_timestamp_parser_handles_hours():
    assert timestamp_to_seconds("01:02:03.5") == 3723
