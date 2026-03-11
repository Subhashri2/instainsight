try:
    import scrapling
    from scrapling.fetchers import StealthyFetcher
    print("SUCCESS: Scrapling and StealthyFetcher imported successfully!")
    print(f"Scrapling version: {scrapling.__version__}")
except ImportError as e:
    print(f"FAILURE: Could not import scrapling. Error: {e}")
except Exception as e:
    print(f"AN ERROR OCCURRED: {e}")
