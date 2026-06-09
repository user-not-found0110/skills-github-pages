#!/usr/bin/env python3
"""Create the Splash Pressure Washing house-wash Search campaign.

Builds the entire campaign — budget, geo targeting, keywords, responsive
search ad, and call asset — in a single atomic Google Ads API request,
so either everything is created or nothing is.

Always start with a dry run; it sends the identical request with
validate_only so Google fully checks it without creating anything:

    python create_campaign.py --customer-id 1234567890 --dry-run
    python create_campaign.py --customer-id 1234567890

WARNING: the campaign is created ENABLED. If billing is active on the
account, it starts spending (up to $50/day) as soon as the real run
succeeds.
"""

import argparse
import sys

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CAMPAIGN_NAME = "House Washing - Chesapeake VA"
AD_GROUP_NAME = "House Washing"
FINAL_URL = "https://splashwashing.com"
PHONE_NUMBER = "757-752-8484"
DAILY_BUDGET_MICROS = 50_000_000  # $50/day
CPC_CEILING_MICROS = 10_000_000  # $10 max cost-per-click

TARGET_CITY = "Chesapeake"
EXCLUDED_ZIPS = ["23324", "23325"]

# (text, match type name) — exact for the core terms, phrase for the rest
KEYWORDS = [
    ("house washing", "EXACT"),
    ("house wash", "EXACT"),
    ("house washing near me", "EXACT"),
    ("soft wash house", "EXACT"),
    ("house washing chesapeake", "EXACT"),
    ("soft washing", "PHRASE"),
    ("soft wash near me", "PHRASE"),
    ("exterior house cleaning", "PHRASE"),
    ("pressure washing house", "PHRASE"),
    ("power washing house", "PHRASE"),
    ("house power washing", "PHRASE"),
    ("vinyl siding cleaning", "PHRASE"),
    ("siding cleaning", "PHRASE"),
    ("wash house exterior", "PHRASE"),
    ("home exterior washing", "PHRASE"),
]

NEGATIVE_KEYWORDS = [
    "jobs",
    "hiring",
    "salary",
    "diy",
    "how to",
    "equipment",
    "machine",
    "rental",
    "rent",
    "car wash",
    "training",
    "certification",
    "franchise",
    "soap",
    "chemicals",
    "bleach mix",
]

HEADLINES = [
    "House Washing Chesapeake VA",  # pinned to position 1
    "Soft Wash House Cleaning",
    "Splash Pressure Washing",
    "Veteran & Firefighter Owned",
    "Free House Wash Quotes",
    "Safe Low-Pressure Soft Wash",
    "Remove Mold, Mildew & Algae",
    "Local Chesapeake Pros",
    "Call 757-752-8484 Today",
    "Make Your Siding Look New",
    "Fast, Friendly Service",
    "Licensed & Insured",
    "Vinyl Siding Cleaning",
    "Same-Week Appointments",
    "Top-Rated House Washing",
]

DESCRIPTIONS = [
    "Gentle soft washing that removes mold, mildew & grime without damaging your siding.",
    "Veteran & firefighter owned, serving Chesapeake VA. Get your free quote today!",
    "Professional house washing with safe, low-pressure equipment. Licensed & insured.",
    "Boost curb appeal fast. Call 757-752-8484 or visit us online for a free estimate.",
]

# Temporary IDs let later operations in the same request reference
# resources created by earlier ones.
BUDGET_TMP = -1
CAMPAIGN_TMP = -2
AD_GROUP_TMP = -3
CALL_ASSET_TMP = -4


def resolve_geo_target(client, customer_id, name, expected_type):
    """Look up a geo target constant ID by name, e.g. a city or ZIP."""
    svc = client.get_service("GeoTargetConstantService")
    request = client.get_type("SuggestGeoTargetConstantsRequest")
    request.locale = "en"
    request.country_code = "US"
    request.location_names.names.append(name)
    response = svc.suggest_geo_target_constants(request=request)

    for suggestion in response.geo_target_constant_suggestions:
        gtc = suggestion.geo_target_constant
        if gtc.status != client.enums.GeoTargetConstantStatusEnum.ENABLED:
            continue
        if gtc.target_type != expected_type:
            continue
        if "Virginia" not in gtc.canonical_name:
            continue
        print(f"  {name} -> {gtc.canonical_name} (geoTargetConstants/{gtc.id})")
        return gtc.id

    sys.exit(
        f"Could not resolve location '{name}' (type {expected_type}) in Virginia. "
        "Check the name and try again."
    )


def new_op(client):
    return client.get_type("MutateOperation")


def build_operations(client, customer_id, geo_ids):
    enums = client.enums
    ops = []

    budget_rn = client.get_service("CampaignBudgetService").campaign_budget_path(
        customer_id, BUDGET_TMP
    )
    campaign_rn = client.get_service("CampaignService").campaign_path(
        customer_id, CAMPAIGN_TMP
    )
    ad_group_rn = client.get_service("AdGroupService").ad_group_path(
        customer_id, AD_GROUP_TMP
    )
    asset_rn = client.get_service("AssetService").asset_path(
        customer_id, CALL_ASSET_TMP
    )

    op = new_op(client)
    budget = op.campaign_budget_operation.create
    budget.resource_name = budget_rn
    budget.name = f"{CAMPAIGN_NAME} Budget"
    budget.amount_micros = DAILY_BUDGET_MICROS
    budget.delivery_method = enums.BudgetDeliveryMethodEnum.STANDARD
    budget.explicitly_shared = False
    ops.append(op)

    op = new_op(client)
    campaign = op.campaign_operation.create
    campaign.resource_name = campaign_rn
    campaign.name = CAMPAIGN_NAME
    campaign.status = enums.CampaignStatusEnum.ENABLED
    campaign.advertising_channel_type = enums.AdvertisingChannelTypeEnum.SEARCH
    campaign.campaign_budget = budget_rn
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = False
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False
    # Only show ads to people physically in (or regularly in) the target area,
    # not people merely searching about it.
    campaign.geo_target_type_setting.positive_geo_target_type = (
        enums.PositiveGeoTargetTypeEnum.PRESENCE
    )
    campaign.geo_target_type_setting.negative_geo_target_type = (
        enums.NegativeGeoTargetTypeEnum.PRESENCE
    )
    # Maximize Clicks with a CPC ceiling; switch to Maximize Conversions
    # once conversion tracking has data (see README).
    campaign.target_spend.cpc_bid_ceiling_micros = CPC_CEILING_MICROS
    try:
        # Declaration required by newer API versions; harmless to skip on
        # older library versions where the field doesn't exist.
        campaign.contains_eu_political_advertising = (
            enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
        )
    except AttributeError:
        pass
    ops.append(op)

    op = new_op(client)
    criterion = op.campaign_criterion_operation.create
    criterion.campaign = campaign_rn
    criterion.location.geo_target_constant = f"geoTargetConstants/{geo_ids['city']}"
    ops.append(op)

    for zip_code in EXCLUDED_ZIPS:
        op = new_op(client)
        criterion = op.campaign_criterion_operation.create
        criterion.campaign = campaign_rn
        criterion.negative = True
        criterion.location.geo_target_constant = (
            f"geoTargetConstants/{geo_ids[zip_code]}"
        )
        ops.append(op)

    for text in NEGATIVE_KEYWORDS:
        op = new_op(client)
        criterion = op.campaign_criterion_operation.create
        criterion.campaign = campaign_rn
        criterion.negative = True
        criterion.keyword.text = text
        criterion.keyword.match_type = enums.KeywordMatchTypeEnum.BROAD
        ops.append(op)

    op = new_op(client)
    ad_group = op.ad_group_operation.create
    ad_group.resource_name = ad_group_rn
    ad_group.name = AD_GROUP_NAME
    ad_group.campaign = campaign_rn
    ad_group.status = enums.AdGroupStatusEnum.ENABLED
    ad_group.type_ = enums.AdGroupTypeEnum.SEARCH_STANDARD
    ops.append(op)

    for text, match_type in KEYWORDS:
        op = new_op(client)
        criterion = op.ad_group_criterion_operation.create
        criterion.ad_group = ad_group_rn
        criterion.status = enums.AdGroupCriterionStatusEnum.ENABLED
        criterion.keyword.text = text
        criterion.keyword.match_type = getattr(enums.KeywordMatchTypeEnum, match_type)
        ops.append(op)

    op = new_op(client)
    ad_group_ad = op.ad_group_ad_operation.create
    ad_group_ad.ad_group = ad_group_rn
    ad_group_ad.status = enums.AdGroupAdStatusEnum.ENABLED
    ad = ad_group_ad.ad
    ad.final_urls.append(FINAL_URL)
    rsa = ad.responsive_search_ad
    for i, text in enumerate(HEADLINES):
        headline = client.get_type("AdTextAsset")
        headline.text = text
        if i == 0:
            headline.pinned_field = enums.ServedAssetFieldTypeEnum.HEADLINE_1
        rsa.headlines.append(headline)
    for text in DESCRIPTIONS:
        description = client.get_type("AdTextAsset")
        description.text = text
        rsa.descriptions.append(description)
    rsa.path1 = "house-washing"
    rsa.path2 = "chesapeake"
    ops.append(op)

    op = new_op(client)
    asset = op.asset_operation.create
    asset.resource_name = asset_rn
    asset.call_asset.country_code = "US"
    asset.call_asset.phone_number = PHONE_NUMBER
    ops.append(op)

    op = new_op(client)
    campaign_asset = op.campaign_asset_operation.create
    campaign_asset.campaign = campaign_rn
    campaign_asset.asset = asset_rn
    campaign_asset.field_type = enums.AssetFieldTypeEnum.CALL
    ops.append(op)

    return ops


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--customer-id",
        required=True,
        help="Google Ads customer ID, e.g. 1234567890 (dashes are stripped)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate the full request with Google without creating anything",
    )
    args = parser.parse_args()
    customer_id = args.customer_id.replace("-", "")

    # Looks for google-ads.yaml next to this script, then in the home dir.
    try:
        client = GoogleAdsClient.load_from_storage("google-ads.yaml")
    except FileNotFoundError:
        client = GoogleAdsClient.load_from_storage()

    print("Resolving geo targets…")
    geo_ids = {
        "city": resolve_geo_target(client, customer_id, f"{TARGET_CITY}, Virginia", "City"),
    }
    for zip_code in EXCLUDED_ZIPS:
        geo_ids[zip_code] = resolve_geo_target(client, customer_id, zip_code, "Postal Code")

    ops = build_operations(client, customer_id, geo_ids)

    request = client.get_type("MutateGoogleAdsRequest")
    request.customer_id = customer_id
    request.mutate_operations.extend(ops)
    request.validate_only = args.dry_run

    label = "Validating (dry run)" if args.dry_run else "Creating campaign"
    print(f"{label}: {len(ops)} operations…")

    try:
        response = client.get_service("GoogleAdsService").mutate(request=request)
    except GoogleAdsException as ex:
        print(f"\nRequest failed (request ID {ex.request_id}):", file=sys.stderr)
        for error in ex.failure.errors:
            print(f"  - {error.message}", file=sys.stderr)
            if error.location:
                for elem in error.location.field_path_elements:
                    print(f"      field: {elem.field_name}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("\nDry run passed — Google validated every operation.")
        print("Re-run without --dry-run to create the campaign for real.")
        return

    print("\nCampaign created. Resources:")
    for result in response.mutate_operation_responses:
        # Each response message has exactly one populated result field.
        field = result._pb.WhichOneof("response")
        if field:
            print(f"  {getattr(result, field).resource_name}")

    print(
        "\nThe campaign is LIVE and will start spending (up to $50/day)."
        "\nNext steps (details in README.md):"
        "\n  1. Review it at https://ads.google.com"
        "\n  2. Set up conversion tracking (calls + quote form)"
        "\n  3. After ~30 conversions, switch bidding to Maximize Conversions"
    )


if __name__ == "__main__":
    main()
