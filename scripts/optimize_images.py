"""
This is an attempt about image optimization.
"""

# Import modules
from typing import Optional

import os
import random
import argparse

from PIL import Image  # type: ignore  # pylint: disable=import-error

from lib_color_tree_structure import Recursive3dTree


# Function to get color tuple from pixel access
def get_color_tuple(color_value: float | tuple[int, ...]) -> tuple[int, int, int]:
    """
    Ensure color value is tuple[int, int, int].

    Args:
        color_value (float | tuple[int, ...]): PixelAccess color value

    Returns:
        tuple[int, int, int]: Correct tuple format color
    """

    # Convert the color into RGB
    if isinstance(color_value, float):
        return (int(color_value), int(color_value), int(color_value))
    else:
        return (
            color_value[0],
            color_value[1],
            color_value[2],
        )


# Function to optimize an image
def optimize_image(
    input_file: str,
    output_file: str,
    max_image_size: int = 512,
    max_color_number: int = 20,
    tree_subdividing: int = 20,
    tree_max_depth: int = 5,
) -> None:
    """
    Optimize an image.
    """

    # Check if the input file exists
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file {input_file} does not exist.")

    # Open the image
    image: Image.Image = Image.open(input_file)

    print(f"DEBUG | Opened image {input_file}")

    # Ensure it is RGB
    image = image.convert("RGB")

    # Get width and weight
    img_width: int = image.size[0]
    img_height: int = image.size[1]

    # Initialize target image size variables if needed
    target_image_width: int = img_width
    target_image_height: int = img_height

    # Resize the image so the larger side is at maximum size if there is one larger
    if img_width > img_height and img_height > max_image_size:
        # Calculate the target image dimension to keep the same image ratio
        target_image_width = max_image_size
        target_image_height = int(max_image_size * (img_width / img_height))
        # Resize the image
        image = image.resize((target_image_width, target_image_height))
    # Other side part check
    elif img_width > max_image_size:
        # Calculate the target image dimension to keep the same image ratio
        target_image_width = int(max_image_size * (img_height / img_width))
        target_image_height = max_image_size
        # Resize the image
        image = image.resize((target_image_width, target_image_height))

    print(
        f"DEBUG | Image size ({img_width}, {img_height})"
        f" -> ({target_image_width}, {target_image_height})"
    )

    # Get the image data
    img_data: Optional[Image.core.PixelAccess] = image.load()  # pylint: disable=c-extension-no-member

    if img_data is None:
        raise ValueError("Error while getting pixel access image")

    # Create the tree structure to efficiently process the image colors
    cl_tree: Recursive3dTree = Recursive3dTree(
        start=(0, 0, 0),
        end=(256, 256, 256),
        parent=None,
        current_depth=0,
        dividing_factor=tree_subdividing,
        max_depth=tree_max_depth,
    )

    # We will also keep track of the final average color cluster for each initial color
    final_color_map: dict[tuple[int, int, int], tuple[int, int, int]] = {}

    # The tree will contain only the color cluster average position,
    # we will store in there all the original colors composing each cluster
    # The cluster key will be the average color
    clusters: dict[tuple[int, int, int], list[tuple[int, int, int]]] = {}

    # Initially populate the tree from all the colors
    for x in range(0, target_image_width):
        for y in range(0, target_image_height):
            # Get the color
            cl: tuple[int, int, int] = get_color_tuple(img_data[x, y])

            # Add the color to the tree
            cl_tree.add_color(cl)

            # Add color to final_map
            final_color_map[cl] = cl

            # Each color is it own cluster originally
            clusters[cl] = [cl]

    # failure count to avoid infinite loops
    failure_count: int = 0
    max_failures: int = 100

    # In a first time,
    # we will randomly fuse two closest clusters
    while len(clusters) > max_color_number and failure_count < max_failures:
        print(f"DEBUG | len(clusters) = {len(clusters)}")

        # Get a random cluster color
        cluster_center: tuple[int, int, int] = random.choice(list(clusters.keys()))

        # Get the closest other cluster from this key
        closest_cluster: Optional[tuple[int, int, int]] = cl_tree.get_closest_color(
            from_color=cluster_center, filter_color=set([cluster_center])
        )

        # Check for failure
        if closest_cluster is None:
            failure_count += 1
            continue

        # Merge the two clusters
        new_cluster_colors: list[tuple[int, int, int]] = (
            clusters[cluster_center] + clusters[closest_cluster]
        )

        # New average color center
        new_cluster_center_r: float = 0
        new_cluster_center_g: float = 0
        new_cluster_center_b: float = 0

        col: tuple[int, int, int]
        for col in new_cluster_colors:
            new_cluster_center_r += col[0]
            new_cluster_center_g += col[1]
            new_cluster_center_b += col[2]

        if len(new_cluster_colors) > 0:
            new_cluster_center_r /= float(len(new_cluster_colors))
            new_cluster_center_g /= float(len(new_cluster_colors))
            new_cluster_center_b /= float(len(new_cluster_colors))

        #
        new_cluster_center: tuple[int, int, int] = (
            int(new_cluster_center_r),
            int(new_cluster_center_g),
            int(new_cluster_center_b),
        )

        # Add the new cluster point in the tree
        cl_tree.add_color(new_cluster_center)

        # Remove the old cluster points from the tree
        cl_tree.remove_color(cluster_center)
        cl_tree.remove_color(closest_cluster)

        # Add the new cluster
        clusters[new_cluster_center] = new_cluster_colors

        # Delete the old clusters
        del clusters[cluster_center]
        del clusters[closest_cluster]

        # Update the color mapping
        for col in new_cluster_colors:
            final_color_map[col] = new_cluster_center

    # Map the final colors
    for x in range(0, target_image_width):
        for y in range(0, target_image_height):
            # Get the color
            cl = get_color_tuple(img_data[x, y])

            # Update to the final mapped color
            img_data[x, y] = final_color_map[cl]

    # Save the image
    image.save(output_file, optimize=True)


# Entry point
if __name__ == "__main__":
    # Initialize the parser
    parser = argparse.ArgumentParser(description="Optimize images.")

    # Add arguments
    parser.add_argument(
        "-i", "--input", dest="input_file", type=str, help="Input file.", required=True
    )
    parser.add_argument(
        "-o",
        "--output",
        dest="output_file",
        type=str,
        help="Output file.",
        required=True,
    )
    parser.add_argument(
        "--max_img_size",
        type=int,
        default=512,
        help="Maximum image side size",
    )
    parser.add_argument(
        "--max_cl_nb",
        type=int,
        default=20,
        help="Maximum color in the optimized image",
    )
    parser.add_argument(
        "--tree_subdividing",
        type=list,
        default=[6, 4, 2],
        help="Color tree subdivisions at each level",
    )
    parser.add_argument(
        "--tree_depth",
        type=int,
        default=2,
        help="Color tree depth",
    )

    # Parse arguments
    args = parser.parse_args()

    # Optimize the image
    optimize_image(
        input_file=args.input_file,
        output_file=args.output_file,
        max_image_size=args.max_img_size,
        max_color_number=args.max_cl_nb,
        tree_subdividing=args.tree_subdividing,
        tree_max_depth=args.tree_depth,
    )
